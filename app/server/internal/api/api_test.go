package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"cardstack/server/internal/plaid"
	"cardstack/server/internal/processor"
	"cardstack/server/internal/rewards"
	"cardstack/server/internal/store"
)

type harness struct {
	t        *testing.T
	srv      *Server
	ts       *httptest.Server
	proc     *processor.Mock
	merchant *httptest.Server
	mu       sync.Mutex
	hooks    []map[string]any
	hookFail int
}

const (
	merchantKey    = "msk_test"
	merchantSecret = "whsec_test"
	buttonID       = "btn_test"
)

func newHarness(t *testing.T) *harness {
	t.Helper()
	h := &harness{t: t, proc: processor.NewMock()}
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"), bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	cat, err := rewards.Load(filepath.Join("..", "..", "..", "data", "card_products.json"))
	if err != nil {
		t.Fatal(err)
	}

	h.merchant = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if r.Header.Get("X-CardStack-Signature") != SignPayload(merchantSecret, body) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		h.mu.Lock()
		defer h.mu.Unlock()
		if h.hookFail > 0 {
			h.hookFail--
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		var m map[string]any
		json.Unmarshal(body, &m)
		h.hooks = append(h.hooks, m)
	}))
	t.Cleanup(h.merchant.Close)

	cfg := Config{DevMode: true, ChargeTimeout: 300 * time.Millisecond, WebhookBackoff: time.Millisecond}
	h.srv = New(cfg, st, cat, plaid.NewMock("secret"), h.proc, slog.New(slog.NewTextHandler(io.Discard, nil)))
	h.ts = httptest.NewServer(h.srv.Handler())
	t.Cleanup(h.ts.Close)
	h.srv.cfg.PublicURL = h.ts.URL
	domain := strings.TrimPrefix(h.merchant.URL, "http://")
	if err := h.srv.SeedMerchant(context.Background(), "m1", "Test Shop", "", h.merchant.URL+"/hook", merchantSecret, merchantKey, buttonID, domain); err != nil {
		t.Fatal(err)
	}
	return h
}

func (h *harness) do(method, path, auth string, body any, headers ...string) (int, map[string]any) {
	h.t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, h.ts.URL+path, rd)
	req.Header.Set("Content-Type", "application/json")
	if auth != "" {
		req.Header.Set("Authorization", "Bearer "+auth)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	defer resp.Body.Close()
	var out map[string]any
	json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func (h *harness) signIn(email string) string {
	code, body := h.do("POST", "/server/v1/auth/google", "", map[string]string{"idToken": "dev:" + email})
	if code != 200 {
		h.t.Fatalf("sign in: %d %v", code, body)
	}
	return body["sessionToken"].(string)
}

func (h *harness) link(tok, institution string, accounts ...string) {
	h.t.Helper()
	_, lt := h.do("POST", "/server/v1/plaid/link-token", tok, nil)
	code, body := h.do("POST", "/server/v1/plaid/sandbox-complete", "", map[string]any{
		"linkToken": lt["linkToken"], "institutionId": institution, "accountIds": accounts})
	if code != 200 {
		h.t.Fatalf("link %s: %d %v", institution, code, body)
	}
}

func (h *harness) checkout(order string, cents int, category string) string {
	h.t.Helper()
	code, body := h.do("POST", "/server/v1/merchant/checkout-sessions", merchantKey, map[string]any{
		"buttonId": buttonID, "orderId": order, "amountCents": cents, "category": category, "returnUrl": h.merchant.URL + "/done"})
	if code != 201 {
		h.t.Fatalf("checkout session: %d %v", code, body)
	}
	return body["transactionId"].(string)
}

func (h *harness) cardID(tok, last4 string) string {
	_, body := h.do("GET", "/server/v1/cards", tok, nil)
	for _, c := range body["cards"].([]any) {
		m := c.(map[string]any)
		if m["last4"] == last4 {
			return m["cardId"].(string)
		}
	}
	h.t.Fatalf("no card %s", last4)
	return ""
}

func (h *harness) hookCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.hooks)
}

// TC-01: the button loads only for its allowed domain.
func TestButtonOrigin(t *testing.T) {
	h := newHarness(t)
	code, _ := h.do("GET", "/server/v1/button/"+buttonID, "", nil, "Origin", h.merchant.URL)
	if code != 200 {
		t.Fatalf("allowed origin: %d", code)
	}
	code, body := h.do("GET", "/server/v1/button/"+buttonID, "", nil, "Origin", "https://evil.example")
	if code != 403 || body["error"] != "ButtonNotAllowed" {
		t.Fatalf("wrong origin: %d %v", code, body)
	}
	code, _ = h.do("GET", "/server/v1/button/nope", "", nil, "Origin", h.merchant.URL)
	if code != 403 {
		t.Fatalf("unknown button: %d", code)
	}
}

// TC-06: a Plaid webhook with a bad signature stores nothing.
func TestConnectRejectsBadSignature(t *testing.T) {
	h := newHarness(t)
	tok := h.signIn("a@example.com")
	req, _ := http.NewRequest("POST", h.ts.URL+"/server/v1/connect-bank-account",
		strings.NewReader(`{"userId":"x","publicToken":"y","success":true}`))
	req.Header.Set("Plaid-Verification", "forged")
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != 400 {
		t.Fatalf("want 400, got %d", resp.StatusCode)
	}
	_, body := h.do("GET", "/server/v1/cards", tok, nil)
	if len(body["cards"].([]any)) != 0 {
		t.Fatal("cards were stored from a forged webhook")
	}
}

// Full checkout: best card chosen, charged once, merchant notified, history and aggregator updated.
func TestCheckoutHappyPath(t *testing.T) {
	h := newHarness(t)
	tok := h.signIn("shopper@example.com")
	h.link(tok, "ins_amex")
	h.link(tok, "ins_wf")
	tx := h.checkout("ORD-1", 8000, "Restaurants")

	code, sel := h.do("POST", "/server/v1/select-card", tok, map[string]string{"transactionId": tx})
	if code != 200 {
		t.Fatalf("select: %d %v", code, sel)
	}
	top := sel["ranked"].([]any)[0].(map[string]any)
	if top["productName"] != "American Express Gold Card" {
		t.Fatalf("want Amex Gold for dining, got %v", top["productName"])
	}

	code, pay := h.do("POST", "/server/v1/process-card-payment", tok, map[string]string{"transactionId": tx}, "Idempotency-Key", tx)
	if code != 200 || pay["state"] != "SUCCEEDED" {
		t.Fatalf("pay: %d %v", code, pay)
	}
	// TC-05: a repeated submission returns the first result and does not charge again.
	code, _ = h.do("POST", "/server/v1/process-card-payment", tok, map[string]string{"transactionId": tx})
	if code != 409 || h.proc.Calls != 1 {
		t.Fatalf("duplicate: %d, processor calls %d", code, h.proc.Calls)
	}

	h.srv.Tick(context.Background())
	if h.hookCount() != 1 || h.hooks[0]["state"] != "SUCCEEDED" || h.hooks[0]["orderId"] != "ORD-1" {
		t.Fatalf("merchant webhook: %v", h.hooks)
	}
	code, mres := h.do("GET", "/server/v1/merchant/transactions/"+tx, merchantKey, nil)
	if code != 200 || mres["status"] != "approved" {
		t.Fatalf("merchant lookup: %d %v", code, mres)
	}
	_, hist := h.do("GET", "/server/v1/transactions", tok, nil)
	if items := hist["items"].([]any); len(items) != 1 || items[0].(map[string]any)["pointsEarnedCents"].(float64) != 320 {
		t.Fatalf("history: %v", hist)
	}
	_, ins := h.do("GET", "/server/v1/insights?days=90", tok, nil)
	if ins["totalSpentCents"].(float64) <= 0 {
		t.Fatalf("insights: %v", ins)
	}
}

// TC-08: a decline asks for consent before charging the next card.
func TestDeclineFallbackNeedsConsent(t *testing.T) {
	h := newHarness(t)
	tok := h.signIn("b@example.com")
	h.link(tok, "ins_test", "test_decline")
	h.link(tok, "ins_boa")
	decline := h.cardID(tok, "0002")
	tx := h.checkout("ORD-2", 5000, "Clothing")
	h.do("POST", "/server/v1/select-card", tok, map[string]string{"transactionId": tx})

	code, pay := h.do("POST", "/server/v1/process-card-payment", tok, map[string]any{"transactionId": tx, "cardId": decline})
	if code != 502 || pay["nextCard"] == nil || pay["state"] != "CARD_SELECTED" {
		t.Fatalf("decline: %d %v", code, pay)
	}
	code, _ = h.do("POST", "/server/v1/process-card-payment", tok, map[string]any{"transactionId": tx})
	if code != 400 {
		t.Fatalf("fallback without consent must be refused, got %d", code)
	}
	code, pay = h.do("POST", "/server/v1/process-card-payment", tok, map[string]any{"transactionId": tx, "consentToFallback": true})
	if code != 200 || pay["cardLast4"] != "2270" {
		t.Fatalf("fallback: %d %v", code, pay)
	}
}

// TC-10: a processor timeout goes to UNKNOWN and reconciliation resolves it.
func TestTimeoutReconciles(t *testing.T) {
	h := newHarness(t)
	tok := h.signIn("c@example.com")
	h.link(tok, "ins_test", "test_timeout")
	tx := h.checkout("ORD-3", 2500, "General")
	h.do("POST", "/server/v1/select-card", tok, map[string]string{"transactionId": tx})
	code, pay := h.do("POST", "/server/v1/process-card-payment", tok, map[string]string{"transactionId": tx})
	if code != 202 || pay["state"] != "UNKNOWN" {
		t.Fatalf("timeout: %d %v", code, pay)
	}
	h.srv.Tick(context.Background())
	_, info := h.do("GET", "/server/v1/checkout/"+tx, "", nil)
	if info["state"] != "SUCCEEDED" {
		t.Fatalf("reconcile: %v", info)
	}
}

// TC-09: webhooks retry with backoff and flag the merchant after 5 failures.
func TestWebhookRetries(t *testing.T) {
	h := newHarness(t)
	tok := h.signIn("d@example.com")
	h.link(tok, "ins_citi")
	h.hookFail = 2
	tx := h.checkout("ORD-4", 1000, "General")
	h.do("POST", "/server/v1/select-card", tok, map[string]string{"transactionId": tx})
	h.do("POST", "/server/v1/process-card-payment", tok, map[string]string{"transactionId": tx})
	for i := 0; i < 5 && h.hookCount() == 0; i++ {
		time.Sleep(10 * time.Millisecond)
		h.srv.Tick(context.Background())
	}
	if h.hookCount() != 1 {
		t.Fatalf("webhook not delivered after retries")
	}

	h.hookFail = 100
	tx = h.checkout("ORD-5", 1000, "General")
	h.do("POST", "/server/v1/select-card", tok, map[string]string{"transactionId": tx})
	h.do("POST", "/server/v1/process-card-payment", tok, map[string]string{"transactionId": tx})
	for i := 0; i < 10; i++ {
		time.Sleep(20 * time.Millisecond)
		h.srv.Tick(context.Background())
	}
	var flagged int
	h.srv.st.DB.QueryRow(`SELECT flagged FROM merchant WHERE id = 'm1'`).Scan(&flagged)
	if flagged != 1 {
		t.Fatal("merchant should be flagged after 5 failed attempts")
	}
}

// TC-14: no linked card gives E-SEL-NO-CARD; TC-18: no PAN or raw token is exposed.
func TestNoCardAndNoTokenLeak(t *testing.T) {
	h := newHarness(t)
	tok := h.signIn("e@example.com")
	tx := h.checkout("ORD-6", 1000, "General")
	code, body := h.do("POST", "/server/v1/select-card", tok, map[string]string{"transactionId": tx})
	if code != 404 || body["error"] != "E-SEL-NO-CARD" {
		t.Fatalf("no card: %d %v", code, body)
	}
	h.link(tok, "ins_chase")
	resp, _ := http.Get(h.ts.URL + "/server/v1/cards")
	resp.Body.Close()
	req, _ := http.NewRequest("GET", h.ts.URL+"/server/v1/accounts", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, _ = http.DefaultClient.Do(req)
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if strings.Contains(string(raw), "processor-sandbox") {
		t.Fatal("processor token leaked in API response")
	}
	var sealed []byte
	h.srv.st.DB.QueryRow(`SELECT processor_token FROM user_card LIMIT 1`).Scan(&sealed)
	if bytes.Contains(sealed, []byte("processor-sandbox")) {
		t.Fatal("processor token stored in plain text")
	}
}

// TC-02 / NFR-05: expired or missing sessions are rejected.
func TestSessionRequired(t *testing.T) {
	h := newHarness(t)
	code, body := h.do("GET", "/server/v1/cards", "bogus", nil)
	if code != 401 || body["error"] != "AuthExpired" {
		t.Fatalf("bogus session: %d %v", code, body)
	}
	h.srv.cfg.DevMode = false
	code, _ = h.do("POST", "/server/v1/auth/google", "", map[string]string{"idToken": "dev:x@example.com"})
	if code != 401 {
		t.Fatalf("dev tokens must be refused outside dev mode, got %d", code)
	}
}
