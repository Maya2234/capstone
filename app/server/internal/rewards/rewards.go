// Package rewards loads the card product dataset and computes the effective
// value of a purchase on a card (REQ-04, REQ-15).
package rewards

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strings"
)

type Rule struct {
	Category  string  `json:"category"`
	Rate      float64 `json:"rate"`
	CapCents  int64   `json:"capCents,omitempty"`
	CapPeriod string  `json:"capPeriod,omitempty"`
	CapGroup  string  `json:"capGroup,omitempty"`
	Note      string  `json:"note,omitempty"`
}

// Rotating is a quarterly 5% calendar the consumer activates (Discover it, Freedom Flex).
type Rotating struct {
	Rate               float64 `json:"rate"`
	CapCents           int64   `json:"capCents"`
	CapPeriod          string  `json:"capPeriod"`
	RequiresActivation bool    `json:"requiresActivation"`
}

// Choice is a bonus category the consumer picks (BofA Customized Cash, U.S. Bank Cash+).
type Choice struct {
	Rate      float64  `json:"rate"`
	Picks     int      `json:"picks,omitempty"`
	Default   string   `json:"default"`
	CapCents  int64    `json:"capCents"`
	CapPeriod string   `json:"capPeriod"`
	CapGroup  string   `json:"capGroup,omitempty"`
	Options   []string `json:"options"`
}

// TopCategory earns its rate on whichever eligible category the consumer spends most in (Citi Custom Cash).
type TopCategory struct {
	Rate      float64  `json:"rate"`
	CapCents  int64    `json:"capCents"`
	CapPeriod string   `json:"capPeriod"`
	Eligible  []string `json:"eligible"`
}

type Product struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Issuer          string       `json:"issuer"`
	Network         string       `json:"network"`
	AnnualFeeCents  int64        `json:"annualFeeCents"`
	RewardType      string       `json:"rewardType"`
	Currency        string       `json:"currency"`
	PointValueCents float64      `json:"pointValueCents"`
	BaseRate        float64      `json:"baseRate"`
	Rules           []Rule       `json:"rules"`
	Rotating        *Rotating    `json:"rotating,omitempty"`
	ChoiceCategory  *Choice      `json:"choiceCategory,omitempty"`
	TopCategory     *TopCategory `json:"topCategory,omitempty"`
	SourceURL       string       `json:"sourceUrl"`
	Confidence      string       `json:"confidence"`
	Notes           string       `json:"notes,omitempty"`
}

type Catalog struct {
	AsOf        string              `json:"asOf"`
	CategoryIDs []string            `json:"categories"`
	Products    []Product           `json:"products"`
	CategoryMap map[string][]string `json:"merchantCategoryMap"`
	byID        map[string]*Product
}

func Load(path string) (*Catalog, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read card catalog: %w", err)
	}
	var c Catalog
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("parse card catalog: %w", err)
	}
	c.byID = make(map[string]*Product, len(c.Products))
	for i := range c.Products {
		c.byID[c.Products[i].ID] = &c.Products[i]
	}
	return &c, nil
}

// Categories lists the reward category IDs the dataset uses.
func (c *Catalog) Categories() []string { return c.CategoryIDs }

func (c *Catalog) Product(id string) (*Product, bool) {
	p, ok := c.byID[id]
	return p, ok
}

// RewardCategories maps a merchant's purchase category (for example "Clothing")
// to the reward categories it can earn in. Unknown categories fall back to general.
func (c *Catalog) RewardCategories(merchantCategory string) []string {
	if cats, ok := c.CategoryMap[merchantCategory]; ok {
		return cats
	}
	for k, v := range c.CategoryMap {
		if strings.EqualFold(k, merchantCategory) {
			return v
		}
	}
	return []string{"general"}
}

// CardContext is what the selector knows about one linked card beyond its product.
type CardContext struct {
	// Choices are the consumer's picked bonus categories for choiceCategory cards.
	Choices []string
	// RotatingActive are this quarter's activated rotating categories.
	RotatingActive []string
	// SpentInPeriodCents is spend already counted against each cap key this period.
	SpentInPeriodCents map[string]int64
}

// Earning is the best way a card earns on a purchase.
type Earning struct {
	Rate        float64 // bonus rate applied to the capped portion
	Rule        string  // reward category or feature that produced the rate
	ValueMilli  int64   // expected reward value in thousandths of a cent, for exact comparison
	ValueCents  int64   // ValueMilli rounded to cents for display
	Explanation string
}

// Evaluate returns the best earning for a purchase of amountCents in the given
// reward categories. merchantBrand, if set, matches merchant: rules.
func Evaluate(p *Product, ctx CardContext, amountCents int64, cats []string, merchantBrand string) Earning {
	want := map[string]bool{}
	for _, c := range cats {
		want[c] = true
	}
	if merchantBrand != "" {
		want["merchant:"+strings.ToLower(merchantBrand)] = true
	}

	best := earningAt(p, amountCents, p.BaseRate, 0, 0, "base", fmt.Sprintf("%.4gx base rate", p.BaseRate))

	consider := func(rate float64, capCents, spent int64, rule, why string) {
		e := earningAt(p, amountCents, rate, capCents, spent, rule, why)
		if e.ValueMilli > best.ValueMilli {
			best = e
		}
	}

	for _, r := range p.Rules {
		if strings.HasPrefix(r.Category, "portal:") || !want[r.Category] {
			continue
		}
		key := capKey(r.CapGroup, r.Category)
		consider(r.Rate, r.CapCents, ctx.SpentInPeriodCents[key], r.Category,
			fmt.Sprintf("%.4gx on %s", r.Rate, r.Category))
	}

	if ch := p.ChoiceCategory; ch != nil {
		picks := ctx.Choices
		if len(picks) == 0 && ch.Default != "" {
			picks = []string{ch.Default}
		}
		for _, pick := range picks {
			if want[pick] {
				key := capKey(ch.CapGroup, "choice")
				consider(ch.Rate, ch.CapCents, ctx.SpentInPeriodCents[key], "choice:"+pick,
					fmt.Sprintf("%.4gx on your chosen category %s", ch.Rate, pick))
			}
		}
	}

	if rot := p.Rotating; rot != nil {
		for _, c := range ctx.RotatingActive {
			if want[c] {
				consider(rot.Rate, rot.CapCents, ctx.SpentInPeriodCents["rotating"], "rotating:"+c,
					fmt.Sprintf("%.4gx on this quarter's %s category", rot.Rate, c))
			}
		}
	}

	// Simplification: assume this purchase's category becomes the card's top
	// category for the cycle. The real issuer decides at statement close.
	if tc := p.TopCategory; tc != nil {
		for _, c := range tc.Eligible {
			if want[c] {
				consider(tc.Rate, tc.CapCents, ctx.SpentInPeriodCents["top"], "top:"+c,
					fmt.Sprintf("%.4gx if %s is your top category this cycle", tc.Rate, c))
			}
		}
	}

	return best
}

func capKey(group, category string) string {
	if group != "" {
		return group
	}
	return category
}

// earningAt values a purchase where the bonus rate applies up to the remaining
// cap and the rest earns the base rate.
func earningAt(p *Product, amountCents int64, rate float64, capCents, spent int64, rule, why string) Earning {
	bonusCents := amountCents
	if capCents > 0 {
		remaining := capCents - spent
		if remaining < 0 {
			remaining = 0
		}
		if bonusCents > remaining {
			bonusCents = remaining
		}
	}
	baseCents := amountCents - bonusCents
	// value in cents = dollars * rate * pointValueCents; scale by 1000 to compare exactly.
	milli := (float64(bonusCents)*rate + float64(baseCents)*p.BaseRate) * p.PointValueCents * 10
	if capCents > 0 && baseCents > 0 {
		why += fmt.Sprintf(" (cap reached on $%.2f, rest at %.4gx)", float64(baseCents)/100, p.BaseRate)
	}
	return Earning{
		Rate:        rate,
		Rule:        rule,
		ValueMilli:  int64(math.Round(milli)),
		ValueCents:  int64(math.Round(milli / 1000)),
		Explanation: why,
	}
}
