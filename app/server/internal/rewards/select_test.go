package rewards

import (
	"path/filepath"
	"testing"
	"time"
)

func loadCatalog(t *testing.T) *Catalog {
	t.Helper()
	c, err := Load(filepath.Join("..", "..", "..", "data", "card_products.json"))
	if err != nil {
		t.Fatal(err)
	}
	return c
}

var now = time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)

func card(id, product string, created int) Card {
	return Card{ID: id, ProductID: product, Last4: id, Status: "active",
		CreditLimitCents: 500000, CreatedAt: now.AddDate(0, 0, -created)}
}

func TestCatalogLoads(t *testing.T) {
	c := loadCatalog(t)
	if len(c.Products) < 40 {
		t.Fatalf("want at least 40 products, got %d", len(c.Products))
	}
	for _, p := range c.Products {
		if p.SourceURL == "" || p.PointValueCents <= 0 {
			t.Errorf("%s: missing sourceUrl or pointValueCents", p.ID)
		}
	}
}

// TC-04.1: highest effective value wins.
func TestSelectHighestValue(t *testing.T) {
	c := loadCatalog(t)
	cards := []Card{card("1111", "wf-active-cash", 10), card("2222", "amex-gold", 10)}
	ranked, _ := c.Select(cards, 10000, "Restaurants", "", now)
	if ranked[0].CardID != "2222" {
		t.Fatalf("want Amex Gold (4x dining) first, got %+v", ranked[0])
	}
	if ranked[0].ExpectedValueCents != 400 {
		t.Errorf("want 400 cents on $100 dining, got %d", ranked[0].ExpectedValueCents)
	}
}

// TC-04.2: ties break by preferred, then lowest utilization, then oldest.
func TestSelectTieBreaks(t *testing.T) {
	c := loadCatalog(t)
	a, b := card("aaaa", "wf-active-cash", 5), card("bbbb", "fidelity-rewards-visa", 50)
	b.Preferred = true
	ranked, _ := c.Select([]Card{a, b}, 5000, "Clothing", "", now)
	if ranked[0].CardID != "bbbb" {
		t.Fatalf("preferred card should win a tie, got %s", ranked[0].CardID)
	}

	b.Preferred = false
	a.BalanceCents, b.BalanceCents = 400000, 100000
	ranked, _ = c.Select([]Card{a, b}, 5000, "Clothing", "", now)
	if ranked[0].CardID != "bbbb" {
		t.Fatalf("lower utilization should win, got %s", ranked[0].CardID)
	}

	a.BalanceCents, b.BalanceCents = 0, 0
	ranked, _ = c.Select([]Card{a, b}, 5000, "Clothing", "", now)
	if ranked[0].CardID != "bbbb" {
		t.Fatalf("older card should win, got %s", ranked[0].CardID)
	}
}

// TC-04.3 (edge case EC-01/EC-02): frozen, expired, and over-limit cards are excluded.
func TestSelectExcludesIneligible(t *testing.T) {
	c := loadCatalog(t)
	frozen := card("f", "amex-gold", 1)
	frozen.Status = "frozen"
	expired := card("e", "amex-gold", 1)
	expired.ExpiresAt = now.AddDate(0, -1, 0)
	full := card("x", "amex-gold", 1)
	full.BalanceCents = 499000
	ok := card("o", "wf-active-cash", 1)
	ranked, excluded := c.Select([]Card{frozen, expired, full, ok}, 5000, "Restaurants", "", now)
	if len(ranked) != 1 || ranked[0].CardID != "o" || len(excluded) != 3 {
		t.Fatalf("want only o eligible, got ranked=%v excluded=%v", ranked, excluded)
	}
}

func TestCapSplitsBonusAndBase(t *testing.T) {
	c := loadCatalog(t)
	bcp := card("b", "amex-blue-cash-preferred", 1)
	bcp.Context.SpentInPeriodCents = map[string]int64{"groceries": 595000}
	ranked, _ := c.Select([]Card{bcp}, 10000, "Groceries", "", now)
	// $50 at 6% + $50 at 1% = 350 cents
	if ranked[0].ExpectedValueCents != 350 {
		t.Fatalf("want 350 cents after cap, got %d (%s)", ranked[0].ExpectedValueCents, ranked[0].Reason)
	}
}

func TestMerchantBrandAndChoice(t *testing.T) {
	c := loadCatalog(t)
	prime := card("p", "chase-prime-visa", 1)
	boa := card("q", "boa-customized-cash", 1)
	boa.Context.Choices = []string{"online_retail"}
	ranked, _ := c.Select([]Card{prime, boa}, 10000, "Electronics", "amazon", now)
	if ranked[0].CardID != "p" || ranked[0].ExpectedValueCents != 500 {
		t.Fatalf("want Prime Visa 5%% at Amazon, got %+v", ranked[0])
	}
	ranked, _ = c.Select([]Card{prime, boa}, 10000, "Electronics", "", now)
	if ranked[0].CardID != "q" || ranked[0].ExpectedValueCents != 300 {
		t.Fatalf("want BofA 3%% chosen online category, got %+v", ranked[0])
	}
}

func TestPortalRatesIgnored(t *testing.T) {
	c := loadCatalog(t)
	vx := card("v", "capone-venture-x", 1)
	ranked, _ := c.Select([]Card{vx}, 10000, "Hotel", "", now)
	if ranked[0].ExpectedValueCents != 200 {
		t.Fatalf("portal 10x must not apply at a merchant checkout, got %d", ranked[0].ExpectedValueCents)
	}
}
