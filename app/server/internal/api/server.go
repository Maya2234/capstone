// Package api serves the CardStack HTTP API under /server/v1 (Technical Specification §3).
package api

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"cardstack/server/internal/plaid"
	"cardstack/server/internal/processor"
	"cardstack/server/internal/rewards"
	"cardstack/server/internal/store"
)

//go:embed web
var webFS embed.FS

type Config struct {
	PublicURL      string        // base URL this server is reachable at, e.g. http://localhost:8080
	DevMode        bool          // accepts dev:<email> sign-in tokens; never enable in production
	GoogleClientID string        // when set, Google ID tokens are verified against it
	AppOrigins     []string      // consumer app origins allowed by CORS
	SessionTTL     time.Duration // NFR-05: 30 minutes of inactivity
	ChargeTimeout  time.Duration // REQ-10: 10 seconds
	WebhookBackoff time.Duration // first retry delay; doubles each attempt (REQ-09)
}

type Server struct {
	cfg     Config
	st      *store.Store
	cat     *rewards.Catalog
	plaid   *plaid.Mock
	proc    processor.Processor
	log     *slog.Logger
	http    *http.Client
	nowFunc func() time.Time
}

func New(cfg Config, st *store.Store, cat *rewards.Catalog, pl *plaid.Mock, proc processor.Processor, log *slog.Logger) *Server {
	if cfg.SessionTTL == 0 {
		cfg.SessionTTL = 30 * time.Minute
	}
	if cfg.ChargeTimeout == 0 {
		cfg.ChargeTimeout = 10 * time.Second
	}
	if cfg.WebhookBackoff == 0 {
		cfg.WebhookBackoff = time.Minute
	}
	return &Server{cfg: cfg, st: st, cat: cat, plaid: pl, proc: proc, log: log,
		http: &http.Client{Timeout: 10 * time.Second}, nowFunc: time.Now}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	v := "/server/v1"

	// Auth (I2, I7)
	mux.HandleFunc("POST "+v+"/auth/google", s.handleGoogleAuth)
	mux.HandleFunc("POST "+v+"/auth/logout", s.authed(s.handleLogout))
	mux.HandleFunc("GET "+v+"/me", s.authed(s.handleMe))

	// Card management (I8) and reward catalog
	mux.HandleFunc("GET "+v+"/cards", s.authed(s.handleListCards))
	mux.HandleFunc("PUT "+v+"/cards/{id}/preferred", s.authed(s.handleSetPreferred))
	mux.HandleFunc("PATCH "+v+"/cards/{id}", s.authed(s.handleUpdateCard))
	mux.HandleFunc("DELETE "+v+"/cards/{id}", s.authed(s.handleRemoveCard))
	mux.HandleFunc("GET "+v+"/card-products", s.handleCardProducts)
	mux.HandleFunc("GET "+v+"/recommend", s.authed(s.handleRecommend))

	// Financial Institution Setup (I9) and the aggregator
	mux.HandleFunc("POST "+v+"/plaid/link-token", s.authed(s.handleLinkToken))
	mux.HandleFunc("GET "+v+"/plaid/institutions", s.handleInstitutions)
	mux.HandleFunc("POST "+v+"/plaid/sandbox-complete", s.handleSandboxComplete)
	mux.HandleFunc("POST "+v+"/connect-bank-account", s.handleConnectBankAccount)
	mux.HandleFunc("GET "+v+"/accounts", s.authed(s.handleAccounts))
	mux.HandleFunc("GET "+v+"/insights", s.authed(s.handleInsights))
	mux.HandleFunc("GET "+v+"/external-transactions", s.authed(s.handleExternalTransactions))

	// Checkout (I1, I3, I5, I10)
	mux.HandleFunc("GET "+v+"/button/{id}", s.handleButton)
	mux.HandleFunc("POST "+v+"/merchant/checkout-sessions", s.handleCreateCheckoutSession)
	mux.HandleFunc("GET "+v+"/merchant/transactions/{id}", s.handleMerchantTransaction)
	mux.HandleFunc("GET "+v+"/checkout/{id}", s.handleCheckoutInfo)
	mux.HandleFunc("POST "+v+"/checkout/{id}/cancel", s.authed(s.handleCheckoutCancel))
	mux.HandleFunc("POST "+v+"/select-card", s.authed(s.handleSelectCard))
	mux.HandleFunc("POST "+v+"/process-card-payment", s.authed(s.handleProcessPayment))
	mux.HandleFunc("GET "+v+"/transactions", s.authed(s.handleTransactions))

	mux.HandleFunc("GET "+v+"/config", func(w http.ResponseWriter, r *http.Request) {
		appURL := ""
		if len(s.cfg.AppOrigins) > 0 {
			appURL = s.cfg.AppOrigins[0]
		}
		writeJSON(w, http.StatusOK, map[string]any{"devMode": s.cfg.DevMode, "googleClientId": s.cfg.GoogleClientID, "appUrl": appURL})
	})
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	// Checkout Button script, Checkout Interface pages, and the mock Plaid Link page.
	web, _ := fs.Sub(webFS, "web")
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(web)))
	mux.HandleFunc("GET /checkout/{id}", s.page(web, "checkout.html"))
	mux.HandleFunc("GET /sandbox/link", s.page(web, "link.html"))

	return s.recoverer(s.cors(mux))
}

func (s *Server) page(web fs.FS, name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := fs.ReadFile(web, name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(b)
	}
}

// ---- middleware and helpers ---------------------------------------------

type ctxKey int

const userKey ctxKey = 0

func userID(r *http.Request) string { return r.Context().Value(userKey).(string) }

func bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if t, ok := strings.CutPrefix(h, "Bearer "); ok {
		return strings.TrimSpace(t)
	}
	return ""
}

func (s *Server) authed(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tok := bearer(r)
		if tok == "" {
			writeErr(w, http.StatusUnauthorized, "AuthInvalidToken", "sign in required")
			return
		}
		uid, err := s.st.TouchSession(r.Context(), tok, s.cfg.SessionTTL)
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusUnauthorized, "AuthExpired", "session expired; sign in again")
			return
		}
		if err != nil {
			s.storeErr(w, err)
			return
		}
		h(w, r.WithContext(context.WithValue(r.Context(), userKey, uid)))
	}
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		// The button lookup is called from any merchant page; its own handler enforces allowed_domain.
		allowed := strings.HasPrefix(r.URL.Path, "/server/v1/button/") || origin == s.cfg.PublicURL
		for _, o := range s.cfg.AppOrigins {
			if origin == o {
				allowed = true
			}
		}
		if origin != "" && allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				s.log.Error("panic", "path", r.URL.Path, "err", v)
				writeErr(w, http.StatusInternalServerError, "Internal", "unexpected error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type apiError struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, apiError{Error: code, Message: msg})
}

func (s *Server) storeErr(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "NotFound", "not found")
		return
	}
	s.log.Error("store", "err", err)
	writeErr(w, http.StatusServiceUnavailable, "StoreUnavailable", "please try again")
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := dec.Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "BadInput", "invalid JSON body")
		return false
	}
	return true
}

func hostOf(origin string) string {
	u, err := url.Parse(origin)
	if err != nil {
		return ""
	}
	return u.Host
}
