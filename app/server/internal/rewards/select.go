package rewards

import (
	"sort"
	"time"
)

// Card is a linked card as the selector sees it.
type Card struct {
	ID               string
	ProductID        string
	Last4            string
	Network          string
	Preferred        bool
	Status           string // active, frozen, expired
	ExpiresAt        time.Time
	CreditLimitCents int64
	BalanceCents     int64
	CreatedAt        time.Time
	Context          CardContext
}

func (c Card) utilization() float64 {
	if c.CreditLimitCents <= 0 {
		return 1
	}
	return float64(c.BalanceCents) / float64(c.CreditLimitCents)
}

// Ranked is one entry in the ranked list returned by POST /select-card.
type Ranked struct {
	CardID             string  `json:"cardId"`
	Last4              string  `json:"last4"`
	Network            string  `json:"network"`
	ProductName        string  `json:"productName"`
	ExpectedValueCents int64   `json:"expectedValueCents"`
	Rate               float64 `json:"rate"`
	Rule               string  `json:"rule"`
	Reason             string  `json:"reason"`
	valueMilli         int64
	card               Card
}

// Excluded explains why a card was left out of the ranking.
type Excluded struct {
	CardID string `json:"cardId"`
	Reason string `json:"reason"`
}

// Select ranks eligible cards for a purchase by effective value (REQ-04).
// Ties break by preferred card, then lowest utilization, then oldest card.
func (c *Catalog) Select(cards []Card, amountCents int64, merchantCategory, merchantBrand string, now time.Time) ([]Ranked, []Excluded) {
	cats := c.RewardCategories(merchantCategory)
	var ranked []Ranked
	var excluded []Excluded
	for _, card := range cards {
		if why := ineligible(card, amountCents, now); why != "" {
			excluded = append(excluded, Excluded{CardID: card.ID, Reason: why})
			continue
		}
		p, ok := c.Product(card.ProductID)
		if !ok {
			excluded = append(excluded, Excluded{CardID: card.ID, Reason: "unknown card product"})
			continue
		}
		e := Evaluate(p, card.Context, amountCents, cats, merchantBrand)
		ranked = append(ranked, Ranked{
			CardID:             card.ID,
			Last4:              card.Last4,
			Network:            card.Network,
			ProductName:        p.Name,
			ExpectedValueCents: e.ValueCents,
			Rate:               e.Rate,
			Rule:               e.Rule,
			Reason:             e.Explanation,
			valueMilli:         e.ValueMilli,
			card:               card,
		})
	}
	sort.SliceStable(ranked, func(i, j int) bool {
		a, b := ranked[i], ranked[j]
		if a.valueMilli != b.valueMilli {
			return a.valueMilli > b.valueMilli
		}
		if a.card.Preferred != b.card.Preferred {
			return a.card.Preferred
		}
		if ua, ub := a.card.utilization(), b.card.utilization(); ua != ub {
			return ua < ub
		}
		return a.card.CreatedAt.Before(b.card.CreatedAt)
	})
	return ranked, excluded
}

func ineligible(c Card, amountCents int64, now time.Time) string {
	switch {
	case c.Status == "frozen":
		return "card is frozen"
	case c.Status == "expired" || (!c.ExpiresAt.IsZero() && now.After(c.ExpiresAt)):
		return "card is expired"
	case c.Status != "" && c.Status != "active":
		return "card is not active"
	case c.CreditLimitCents > 0 && c.CreditLimitCents-c.BalanceCents < amountCents:
		return "not enough available credit"
	}
	return ""
}
