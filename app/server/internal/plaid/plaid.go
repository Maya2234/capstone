// Package plaid is the Financial Institution Setup adapter (REQ-06, I9).
//
// Mock is a stand-in for the Plaid sandbox so the system runs with no API keys.
// It mimics Plaid's shape: a link token, a public token exchanged for an item,
// accounts with processor tokens, and a signed webhook. A real adapter that
// calls Plaid's API can replace it behind the same interface.
package plaid

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	mrand "math/rand/v2"
	"strings"
	"sync"
	"time"
)

type Account struct {
	AccountID        string `json:"accountId"`
	Name             string `json:"name"`
	Type             string `json:"type"`    // credit or depository
	Subtype          string `json:"subtype"` // credit card, checking, savings
	Mask             string `json:"mask"`
	Network          string `json:"network,omitempty"`
	CardProductID    string `json:"cardProductId,omitempty"`
	CreditLimitCents int64  `json:"creditLimitCents,omitempty"`
	BalanceCents     int64  `json:"balanceCents"`
	ExpiresAt        string `json:"expiresAt,omitempty"`
}

type Institution struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Accounts []Account `json:"accounts"`
}

type Transaction struct {
	AccountID   string `json:"accountId"`
	Date        string `json:"date"`
	Merchant    string `json:"merchant"`
	Category    string `json:"category"`
	AmountCents int64  `json:"amountCents"`
}

// Item is what the exchange step returns: the linked institution and its accounts.
type Item struct {
	ItemID       string
	Institution  Institution
	Transactions []Transaction
	// ProcessorTokens maps accountId to a token the payment processor can charge.
	ProcessorTokens map[string]string
}

type Provider interface {
	Institutions() []Institution
	CreateLinkToken(userID string) string
	// CreatePublicToken simulates the consumer finishing Plaid Link.
	CreatePublicToken(linkToken, institutionID string, accountIDs []string) (string, error)
	Exchange(publicToken string) (Item, error)
	SignWebhook(body []byte) string
	VerifyWebhook(body []byte, signature string) bool
}

type Mock struct {
	secret []byte
	mu     sync.Mutex
	links  map[string]string // linkToken -> userID
	public map[string]pending
}

type pending struct {
	institutionID string
	accountIDs    []string
}

func NewMock(webhookSecret string) *Mock {
	return &Mock{secret: []byte(webhookSecret), links: map[string]string{}, public: map[string]pending{}}
}

func token(prefix string) string {
	b := make([]byte, 12)
	rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func (m *Mock) CreateLinkToken(userID string) string {
	t := token("link-sandbox-")
	m.mu.Lock()
	m.links[t] = userID
	m.mu.Unlock()
	return t
}

// LinkUser returns the user a link token was issued to.
func (m *Mock) LinkUser(linkToken string) (string, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.links[linkToken]
	return u, ok
}

func (m *Mock) CreatePublicToken(linkToken, institutionID string, accountIDs []string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.links[linkToken]; !ok {
		return "", fmt.Errorf("unknown link token")
	}
	if _, ok := findInstitution(institutionID); !ok {
		return "", fmt.Errorf("unknown institution %q", institutionID)
	}
	t := token("public-sandbox-")
	m.public[t] = pending{institutionID, accountIDs}
	return t, nil
}

func (m *Mock) Exchange(publicToken string) (Item, error) {
	m.mu.Lock()
	p, ok := m.public[publicToken]
	delete(m.public, publicToken)
	m.mu.Unlock()
	if !ok {
		return Item{}, fmt.Errorf("invalid or used public token")
	}
	inst, _ := findInstitution(p.institutionID)
	if len(p.accountIDs) > 0 {
		keep := map[string]bool{}
		for _, id := range p.accountIDs {
			keep[id] = true
		}
		var accts []Account
		for _, a := range inst.Accounts {
			if keep[a.AccountID] {
				accts = append(accts, a)
			}
		}
		inst.Accounts = accts
	}
	item := Item{ItemID: token("item-sandbox-"), Institution: inst, ProcessorTokens: map[string]string{}}
	for _, a := range inst.Accounts {
		if a.Type == "credit" {
			// Encodes the mask so the mock processor can simulate test-card behavior.
			item.ProcessorTokens[a.AccountID] = "processor-sandbox-" + a.Mask + "-" + token("")
		}
	}
	item.Transactions = history(inst)
	return item, nil
}

func (m *Mock) SignWebhook(body []byte) string {
	mac := hmac.New(sha256.New, m.secret)
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func (m *Mock) VerifyWebhook(body []byte, signature string) bool {
	want := m.SignWebhook(body)
	return hmac.Equal([]byte(want), []byte(strings.TrimSpace(signature)))
}

func (m *Mock) Institutions() []Institution { return sandbox }

func findInstitution(id string) (Institution, bool) {
	for _, i := range sandbox {
		if i.ID == id {
			return i, true
		}
	}
	return Institution{}, false
}

func credit(id, name, product, network, mask string, limit, bal int64) Account {
	return Account{AccountID: id, Name: name, Type: "credit", Subtype: "credit card", Mask: mask, Network: network,
		CardProductID: product, CreditLimitCents: limit, BalanceCents: bal, ExpiresAt: "2030-08-31T00:00:00Z"}
}

func deposit(id, name, subtype, mask string, bal int64) Account {
	return Account{AccountID: id, Name: name, Type: "depository", Subtype: subtype, Mask: mask, BalanceCents: bal}
}

// sandbox institutions. Masks 0002 and 0010 are test cards: the mock processor
// always declines 0002 and times out on 0010, like Stripe's test card numbers.
var sandbox = []Institution{
	{ID: "ins_chase", Name: "Chase", Accounts: []Account{
		credit("chase_csp", "Chase Sapphire Preferred", "chase-sapphire-preferred", "Visa", "4821", 1500000, 231400),
		credit("chase_cfu", "Chase Freedom Unlimited", "chase-freedom-unlimited", "Visa", "9934", 800000, 54200),
		credit("chase_prime", "Prime Visa", "chase-prime-visa", "Visa", "3307", 1000000, 112900),
		deposit("chase_chk", "Chase Total Checking", "checking", "1120", 482513),
	}},
	{ID: "ins_amex", Name: "American Express", Accounts: []Account{
		credit("amex_gold", "American Express Gold Card", "amex-gold", "Amex", "1005", 2000000, 389000),
		credit("amex_bcp", "Blue Cash Preferred", "amex-blue-cash-preferred", "Amex", "2009", 900000, 67000),
	}},
	{ID: "ins_citi", Name: "Citi", Accounts: []Account{
		credit("citi_dc", "Citi Double Cash", "citi-double-cash", "Mastercard", "7712", 1200000, 15000),
		credit("citi_cc", "Citi Custom Cash", "citi-custom-cash", "Mastercard", "6630", 500000, 0),
	}},
	{ID: "ins_capone", Name: "Capital One", Accounts: []Account{
		credit("capone_savor", "Capital One Savor", "capone-savor", "Mastercard", "5521", 700000, 98000),
		credit("capone_vx", "Capital One Venture X", "capone-venture-x", "Visa", "8840", 3000000, 410000),
		deposit("capone_360", "360 Performance Savings", "savings", "4402", 1250000),
	}},
	{ID: "ins_discover", Name: "Discover", Accounts: []Account{
		credit("disc_it", "Discover it Cash Back", "discover-it-cash-back", "Discover", "3156", 600000, 20000),
	}},
	{ID: "ins_wf", Name: "Wells Fargo", Accounts: []Account{
		credit("wf_ac", "Wells Fargo Active Cash", "wf-active-cash", "Visa", "4418", 1000000, 0),
		credit("wf_auto", "Wells Fargo Autograph", "wf-autograph", "Visa", "6203", 800000, 31000),
		deposit("wf_chk", "Everyday Checking", "checking", "8891", 217044),
	}},
	{ID: "ins_boa", Name: "Bank of America", Accounts: []Account{
		credit("boa_cc", "Customized Cash Rewards", "boa-customized-cash", "Visa", "2270", 600000, 45000),
	}},
	{ID: "ins_test", Name: "CardStack Test Bank", Accounts: []Account{
		credit("test_decline", "Test Card (always declines)", "wf-active-cash", "Visa", "0002", 1000000, 0),
		credit("test_timeout", "Test Card (processor timeout)", "citi-double-cash", "Visa", "0010", 1000000, 0),
	}},
}

var merchants = []struct{ name, category string }{
	{"Whole Foods Market", "Groceries"}, {"Trader Joe's", "Groceries"}, {"Shell", "Gas"}, {"Chevron", "Gas"},
	{"Chipotle", "Restaurants"}, {"DoorDash", "Food Delivery"}, {"Starbucks", "Restaurants"},
	{"Netflix", "Streaming"}, {"Spotify", "Streaming"}, {"Amazon", "General"}, {"Target", "General"},
	{"Uber", "Rideshare"}, {"Delta Air Lines", "Airline"}, {"Marriott", "Hotel"}, {"CVS Pharmacy", "Pharmacy"},
	{"Nike", "Clothing"}, {"Best Buy", "Electronics"}, {"Home Depot", "Home"}, {"AMC Theatres", "Entertainment"},
}

// amountRange is a plausible purchase size in cents for a category.
func amountRange(category string) (int64, int64) {
	switch category {
	case "Streaming":
		return 699, 2299
	case "Restaurants", "Food Delivery":
		return 600, 6500
	case "Gas":
		return 2500, 7500
	case "Groceries":
		return 1800, 16000
	case "Rideshare", "Pharmacy":
		return 900, 4500
	case "Airline":
		return 12000, 52000
	case "Hotel":
		return 15000, 60000
	case "Entertainment":
		return 1200, 6000
	default:
		return 1500, 15000
	}
}

// history generates 90 days of plausible spending per account, seeded by
// institution so a re-link shows the same history.
func history(inst Institution) []Transaction {
	seed := uint64(0)
	for _, c := range inst.ID {
		seed = seed*31 + uint64(c)
	}
	r := mrand.New(mrand.NewPCG(seed, 7))
	today := time.Now().UTC().Truncate(24 * time.Hour)
	var out []Transaction
	for _, a := range inst.Accounts {
		n := 12 + r.IntN(12)
		for i := 0; i < n; i++ {
			m := merchants[r.IntN(len(merchants))]
			lo, hi := amountRange(m.category)
			amt := lo + r.Int64N(hi-lo)
			out = append(out, Transaction{
				AccountID:   a.AccountID,
				Date:        today.AddDate(0, 0, -r.IntN(90)).Format("2006-01-02"),
				Merchant:    m.name,
				Category:    m.category,
				AmountCents: amt,
			})
		}
	}
	return out
}
