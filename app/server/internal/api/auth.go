package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type googleIdentity struct {
	Sub, Email, Name string
}

// verifyGoogle checks an ID token with Google's tokeninfo endpoint and that it
// was issued for our client ID. In dev mode, "dev:<email>" stands in for a token.
func (s *Server) verifyGoogle(r *http.Request, idToken string) (googleIdentity, error) {
	if email, ok := strings.CutPrefix(idToken, "dev:"); ok {
		if !s.cfg.DevMode {
			return googleIdentity{}, fmt.Errorf("dev tokens are disabled")
		}
		email = strings.ToLower(strings.TrimSpace(email))
		if !strings.Contains(email, "@") {
			return googleIdentity{}, fmt.Errorf("invalid email")
		}
		return googleIdentity{Email: email, Name: strings.Split(email, "@")[0]}, nil
	}
	if s.cfg.GoogleClientID == "" {
		return googleIdentity{}, fmt.Errorf("Google sign-in is not configured")
	}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet,
		"https://oauth2.googleapis.com/tokeninfo?id_token="+url.QueryEscape(idToken), nil)
	resp, err := s.http.Do(req)
	if err != nil {
		return googleIdentity{}, err
	}
	defer resp.Body.Close()
	var info struct {
		Aud, Sub, Email, Name string
		EmailVerified         string `json:"email_verified"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&info) != nil {
		return googleIdentity{}, fmt.Errorf("invalid Google token")
	}
	if info.Aud != s.cfg.GoogleClientID || info.EmailVerified != "true" {
		return googleIdentity{}, fmt.Errorf("token not issued for this app")
	}
	return googleIdentity{Sub: info.Sub, Email: strings.ToLower(info.Email), Name: info.Name}, nil
}

func newSessionToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func (s *Server) handleGoogleAuth(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken string `json:"idToken"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	id, err := s.verifyGoogle(r, body.IDToken)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "AuthInvalidToken", err.Error())
		return
	}
	u, err := s.st.UpsertUser(r.Context(), id.Email, id.Sub, id.Name)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	tok := newSessionToken()
	exp, err := s.st.CreateSession(r.Context(), u.ID, tok, s.cfg.SessionTTL)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"sessionToken": tok, "userId": u.ID, "email": u.Email, "name": u.Name,
		"expiresAt": exp.Format(time.RFC3339),
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if err := s.st.DeleteSession(r.Context(), bearer(r)); err != nil {
		s.storeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u, err := s.st.UserByID(r.Context(), userID(r))
	if err != nil {
		s.storeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"userId": u.ID, "email": u.Email, "name": u.Name})
}
