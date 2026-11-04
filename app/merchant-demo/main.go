// Command merchant-demo is a sample e-commerce store that accepts CardStack.
//
// It shows the three pieces a merchant integrates:
//  1. the Checkout Button script on the checkout page,
//  2. a server endpoint that creates a checkout session with the secret API key,
//  3. a webhook endpoint that verifies X-CardStack-Signature before trusting a result.
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"
)

//go:embed store.html
var storeHTML string

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

var (
	port          = env("PORT", "4000")
	cardstackURL  = env("CARDSTACK_URL", "http://localhost:8080")
	apiKey        = env("CARDSTACK_API_KEY", "msk_demo_threadline")
	webhookSecret = env("CARDSTACK_WEBHOOK_SECRET", "whsec_demo_threadline")
	buttonID      = env("CARDSTACK_BUTTON_ID", "btn_threadline")
	selfURL       = env("PUBLIC_URL", "http://localhost:"+port)
)

type product struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	PriceCents  int64  `json:"priceCents"`
	Category    string `json:"category"`
	Color       string `json:"color"`
	Description string `json:"description"`
}

// Prices live on the server; the browser only sends product IDs and quantities.
var catalog = []product{
	{"tee", "Everyday Cotton Tee", 2800, "Clothing", "#38BDF8", "Heavyweight organic cotton, relaxed fit."},
	{"hoodie", "Fleece Zip Hoodie", 6800, "Clothing", "#A78BFA", "Brushed fleece with a two-way zip."},
	{"jacket", "Waxed Canvas Jacket", 14900, "Clothing", "#34D399", "Water-resistant canvas, corduroy collar."},
	{"cap", "Six-Panel Cap", 2400, "Clothing", "#F59E0B", "Washed twill with a brass buckle."},
}

type order struct {
	ID            string    `json:"orderId"`
	AmountCents   int64     `json:"amountCents"`
	Items         string    `json:"items"`
	TransactionID string    `json:"transactionId"`
	Status        string    `json:"status"` // awaiting_payment, paid, payment_failed
	UpdatedAt     time.Time `json:"updatedAt"`
	Source        string    `json:"source"` // what last changed the status
}

var (
	mu     sync.Mutex
	orders = map[string]*order{}
	seq    = 1000
)

func main() {
	tmpl := template.Must(template.New("store").Funcs(template.FuncMap{
		"divide": func(c int64) float64 { return float64(c) / 100 },
	}).Parse(storeHTML))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		tmpl.Execute(w, map[string]any{"CardStackURL": cardstackURL, "ButtonID": buttonID, "Products": catalog})
	})
	mux.HandleFunc("GET /done", handleDone)
	mux.HandleFunc("POST /api/cardstack-session", handleCreateSession)
	mux.HandleFunc("POST /webhooks/cardstack", handleWebhook)
	mux.HandleFunc("GET /api/orders", handleOrders)
	log.Printf("Threadline Apparel demo store on %s (CardStack at %s)", selfURL, cardstackURL)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

// handleCreateSession prices the cart and asks CardStack for a checkout session.
func handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var cart struct {
		Items map[string]int `json:"items"`
	}
	if json.NewDecoder(r.Body).Decode(&cart) != nil || len(cart.Items) == 0 {
		http.Error(w, `{"error":"empty cart"}`, http.StatusBadRequest)
		return
	}
	var total int64
	var desc []string
	for _, p := range catalog {
		if q := cart.Items[p.ID]; q > 0 && q < 20 {
			total += p.PriceCents * int64(q)
			desc = append(desc, fmt.Sprintf("%d× %s", q, p.Name))
		}
	}
	if total == 0 {
		http.Error(w, `{"error":"empty cart"}`, http.StatusBadRequest)
		return
	}
	mu.Lock()
	seq++
	id := fmt.Sprintf("TL-%d", seq)
	o := &order{ID: id, AmountCents: total, Items: fmt.Sprint(desc), Status: "awaiting_payment", UpdatedAt: time.Now(), Source: "cart"}
	orders[id] = o
	mu.Unlock()

	body, _ := json.Marshal(map[string]any{
		"buttonId": buttonID, "orderId": id, "amountCents": total, "category": "Clothing",
		"returnUrl": selfURL + "/done?orderId=" + id,
	})
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, cardstackURL+"/server/v1/merchant/checkout-sessions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, `{"error":"CardStack unreachable"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	var session struct {
		TransactionID string `json:"transactionId"`
		CheckoutURL   string `json:"checkoutUrl"`
	}
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 || json.Unmarshal(raw, &session) != nil {
		log.Printf("checkout session failed: %d %s", resp.StatusCode, raw)
		http.Error(w, string(raw), http.StatusBadGateway)
		return
	}
	mu.Lock()
	o.TransactionID = session.TransactionID
	mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"orderId": id, "amountCents": total, "transactionId": session.TransactionID, "checkoutUrl": session.CheckoutURL})
}

// handleWebhook is the only place the store marks an order paid: the browser's
// result can be faked, the signed webhook cannot.
func handleWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(body)
	want := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(want), []byte(r.Header.Get("X-CardStack-Signature"))) {
		log.Printf("rejected webhook with bad signature")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	var ev struct {
		OrderID       string `json:"orderId"`
		TransactionID string `json:"transactionId"`
		State         string `json:"state"`
		AmountCents   int64  `json:"amountCents"`
		Reason        string `json:"reason"`
	}
	if json.Unmarshal(body, &ev) != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	mu.Lock()
	o, ok := orders[ev.OrderID]
	if ok && o.AmountCents == ev.AmountCents {
		switch ev.State {
		case "SUCCEEDED":
			o.Status = "paid"
		case "FAILED", "ABANDONED":
			if o.Status != "paid" {
				o.Status = "payment_failed"
			}
		}
		o.TransactionID, o.UpdatedAt, o.Source = ev.TransactionID, time.Now(), "webhook"
	}
	mu.Unlock()
	log.Printf("webhook: order %s %s %s", ev.OrderID, ev.State, ev.Reason)
	w.WriteHeader(http.StatusNoContent)
}

func handleOrders(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	list := make([]*order, 0, len(orders))
	for _, o := range orders {
		list = append(list, o)
	}
	mu.Unlock()
	sort.Slice(list, func(i, j int) bool { return list[i].ID > list[j].ID })
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// handleDone is the return page when the checkout ran full-page instead of in a popup.
func handleDone(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("orderId")
	mu.Lock()
	o := orders[id]
	mu.Unlock()
	status := "unknown order"
	if o != nil {
		status = o.Status
	}
	fmt.Fprintf(w, `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:24px">
<h1>Order %s</h1><p>Status: <strong>%s</strong></p><p><a href="/">Back to store</a></p>`, template.HTMLEscapeString(id), template.HTMLEscapeString(status))
}
