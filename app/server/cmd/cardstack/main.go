// Command cardstack runs the CardStack API server and its background workers.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"cardstack/server/internal/api"
	"cardstack/server/internal/plaid"
	"cardstack/server/internal/processor"
	"cardstack/server/internal/rewards"
	"cardstack/server/internal/store"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	port := env("PORT", "8080")
	devMode := env("CARDSTACK_DEV", "1") == "1"
	dataDir := env("CARDSTACK_DATA_DIR", "data")
	os.MkdirAll(dataDir, 0o700)

	key, err := tokenKey(filepath.Join(dataDir, "dev-token-key"), devMode)
	if err != nil {
		log.Error("token key", "err", err)
		os.Exit(1)
	}
	st, err := store.Open(env("CARDSTACK_DB", filepath.Join(dataDir, "cardstack.db")), key)
	if err != nil {
		log.Error("open store", "err", err)
		os.Exit(1)
	}
	defer st.Close()

	cat, err := rewards.Load(env("CARDSTACK_CATALOG", filepath.Join("..", "data", "card_products.json")))
	if err != nil {
		log.Error("load card catalog", "err", err)
		os.Exit(1)
	}
	log.Info("card catalog loaded", "products", len(cat.Products), "asOf", cat.AsOf)

	cfg := api.Config{
		PublicURL:      env("PUBLIC_URL", "http://localhost:"+port),
		DevMode:        devMode,
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"),
		AppOrigins:     strings.Split(env("APP_ORIGINS", "http://localhost:8081"), ","),
	}
	if devMode {
		cfg.WebhookBackoff = 5 * time.Second // faster retries for local testing
	}
	srv := api.New(cfg, st, cat, plaid.NewMock(env("PLAID_WEBHOOK_SECRET", "plaid-sandbox-secret")), processor.NewMock(), log)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if devMode {
		// Demo merchant used by app/merchant-demo. These keys are for local development only.
		err := srv.SeedMerchant(ctx, "7d1e0c44-2b6a-4f0e-8c1a-9b8d7e6f5a4b", "Threadline Apparel", "",
			env("DEMO_MERCHANT_WEBHOOK", "http://localhost:4000/webhooks/cardstack"),
			env("DEMO_MERCHANT_WEBHOOK_SECRET", "whsec_demo_threadline"),
			env("DEMO_MERCHANT_API_KEY", "msk_demo_threadline"),
			"btn_threadline", env("DEMO_MERCHANT_DOMAIN", "localhost:4000"))
		if err != nil {
			log.Error("seed demo merchant", "err", err)
		}
		log.Warn("development mode: dev sign-in tokens are accepted and keys are not secret")
	}

	go srv.RunWorkers(ctx, time.Second)

	httpSrv := &http.Server{Addr: ":" + port, Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		shut, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		httpSrv.Shutdown(shut)
	}()
	log.Info("CardStack API listening", "url", cfg.PublicURL)
	if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("serve", "err", err)
		os.Exit(1)
	}
}

// tokenKey reads the 32-byte key that encrypts processor tokens. In production it
// must come from CARDSTACK_TOKEN_KEY (the secret manager); in development a key
// is generated once and kept in the data directory.
func tokenKey(devPath string, devMode bool) ([]byte, error) {
	if v := os.Getenv("CARDSTACK_TOKEN_KEY"); v != "" {
		k, err := hex.DecodeString(v)
		if err != nil || len(k) != 32 {
			return nil, errors.New("CARDSTACK_TOKEN_KEY must be 64 hex characters")
		}
		return k, nil
	}
	if !devMode {
		return nil, errors.New("CARDSTACK_TOKEN_KEY is required outside development mode")
	}
	if b, err := os.ReadFile(devPath); err == nil {
		return hex.DecodeString(strings.TrimSpace(string(b)))
	}
	k := make([]byte, 32)
	rand.Read(k)
	return k, os.WriteFile(devPath, []byte(hex.EncodeToString(k)), 0o600)
}
