package api

import (
	"context"
	"net/http"
	"slices"
	"strconv"
	"time"

	"cardstack/server/internal/rewards"
	"cardstack/server/internal/store"
)

type cardView struct {
	store.UserCard
	ProductName    string            `json:"productName"`
	Issuer         string            `json:"issuer"`
	AnnualFeeCents int64             `json:"annualFeeCents"`
	RewardType     string            `json:"rewardType"`
	Currency       string            `json:"currency"`
	BaseRate       float64           `json:"baseRate"`
	Rules          []rewards.Rule    `json:"rules"`
	ChoiceCategory *rewards.Choice   `json:"choiceCategory,omitempty"`
	Rotating       *rewards.Rotating `json:"rotating,omitempty"`
	Utilization    float64           `json:"utilization"`
	AvailableCents int64             `json:"availableCents"`
	SourceURL      string            `json:"sourceUrl"`
}

func (s *Server) view(c store.UserCard) cardView {
	v := cardView{UserCard: c, AvailableCents: c.CreditLimitCents - c.BalanceCents}
	if c.CreditLimitCents > 0 {
		v.Utilization = float64(c.BalanceCents) / float64(c.CreditLimitCents)
	}
	if p, ok := s.cat.Product(c.ProductID); ok {
		v.ProductName, v.Issuer, v.AnnualFeeCents = p.Name, p.Issuer, p.AnnualFeeCents
		v.RewardType, v.Currency, v.BaseRate, v.Rules = p.RewardType, p.Currency, p.BaseRate, p.Rules
		v.ChoiceCategory, v.Rotating, v.SourceURL = p.ChoiceCategory, p.Rotating, p.SourceURL
	}
	return v
}

func (s *Server) handleListCards(w http.ResponseWriter, r *http.Request) {
	cards, err := s.st.Cards(r.Context(), userID(r))
	if err != nil {
		s.storeErr(w, err)
		return
	}
	out := make([]cardView, 0, len(cards))
	for _, c := range cards {
		out = append(out, s.view(c))
	}
	writeJSON(w, http.StatusOK, map[string]any{"cards": out})
}

func (s *Server) handleSetPreferred(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.st.SetPreferred(r.Context(), userID(r), id); err != nil {
		s.storeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"cardId": id, "preferred": true})
}

func (s *Server) handleRemoveCard(w http.ResponseWriter, r *http.Request) {
	if err := s.st.RemoveCard(r.Context(), userID(r), r.PathValue("id")); err != nil {
		s.storeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleUpdateCard sets a card's chosen bonus categories, activated rotating
// categories, or frozen status.
func (s *Server) handleUpdateCard(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Choices        *[]string `json:"choices"`
		RotatingActive *[]string `json:"rotatingActive"`
		Status         *string   `json:"status"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	c, err := s.st.Card(r.Context(), userID(r), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, err)
		return
	}
	p, _ := s.cat.Product(c.ProductID)
	choices, rot, status := c.Choices, c.RotatingActive, c.Status
	if body.Choices != nil {
		if p == nil || p.ChoiceCategory == nil {
			writeErr(w, http.StatusBadRequest, "BadInput", "this card has no choice category")
			return
		}
		max := max(p.ChoiceCategory.Picks, 1)
		if len(*body.Choices) > max {
			writeErr(w, http.StatusBadRequest, "BadInput", "too many choices for this card")
			return
		}
		for _, ch := range *body.Choices {
			if !slices.Contains(p.ChoiceCategory.Options, ch) {
				writeErr(w, http.StatusBadRequest, "BadInput", "invalid choice "+ch)
				return
			}
		}
		choices = *body.Choices
	}
	if body.RotatingActive != nil {
		if p == nil || p.Rotating == nil {
			writeErr(w, http.StatusBadRequest, "BadInput", "this card has no rotating categories")
			return
		}
		for _, cat := range *body.RotatingActive {
			if !slices.Contains(s.cat.Categories(), cat) {
				writeErr(w, http.StatusBadRequest, "BadInput", "unknown category "+cat)
				return
			}
		}
		rot = *body.RotatingActive
	}
	if body.Status != nil {
		if *body.Status != "active" && *body.Status != "frozen" {
			writeErr(w, http.StatusBadRequest, "BadInput", "status must be active or frozen")
			return
		}
		status = *body.Status
	}
	if err := s.st.UpdateCardSettings(r.Context(), userID(r), c.ID, choices, rot, status); err != nil {
		s.storeErr(w, err)
		return
	}
	c, _ = s.st.Card(r.Context(), userID(r), c.ID)
	writeJSON(w, http.StatusOK, s.view(c))
}

func (s *Server) handleCardProducts(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"asOf": s.cat.AsOf, "products": s.cat.Products, "merchantCategories": s.cat.CategoryMap,
	})
}

// handleRecommend previews which linked card CardStack would pick for a purchase.
func (s *Server) handleRecommend(w http.ResponseWriter, r *http.Request) {
	amount, _ := strconv.ParseInt(r.URL.Query().Get("amountCents"), 10, 64)
	if amount <= 0 {
		amount = 10000
	}
	category := r.URL.Query().Get("category")
	if category == "" {
		category = "General"
	}
	ranked, excluded, err := s.rank(r.Context(), userID(r), amount, category, r.URL.Query().Get("brand"))
	if err != nil {
		s.storeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ranked": nonNilRanked(ranked), "excluded": excluded})
}

func nonNilRanked(r []rewards.Ranked) []rewards.Ranked {
	if r == nil {
		return []rewards.Ranked{}
	}
	return r
}

// rank loads the user's cards with their cap usage and runs card selection.
func (s *Server) rank(ctx context.Context, uid string, amountCents int64, category, brand string) ([]rewards.Ranked, []rewards.Excluded, error) {
	cards, err := s.st.Cards(ctx, uid)
	if err != nil {
		return nil, nil, err
	}
	now := s.nowFunc().UTC()
	in := make([]rewards.Card, 0, len(cards))
	for _, c := range cards {
		spent, err := s.capUsage(ctx, c, now)
		if err != nil {
			return nil, nil, err
		}
		rc := rewards.Card{
			ID: c.ID, ProductID: c.ProductID, Last4: c.Last4, Network: c.Network, Preferred: c.Preferred,
			Status: c.Status, CreditLimitCents: c.CreditLimitCents, BalanceCents: c.BalanceCents,
			CreatedAt: store.ParseTime(c.CreatedAt),
			Context:   rewards.CardContext{Choices: c.Choices, RotatingActive: c.RotatingActive, SpentInPeriodCents: spent},
		}
		if c.ExpiresAt != "" {
			rc.ExpiresAt = store.ParseTime(c.ExpiresAt)
		}
		in = append(in, rc)
	}
	ranked, excluded := s.cat.Select(in, amountCents, category, brand, now)
	return ranked, excluded, nil
}

// capUsage sums this card's succeeded CardStack spend per reward cap key in the
// cap's current period, so bonus caps (REQ-04 effective value) are respected.
func (s *Server) capUsage(ctx context.Context, c store.UserCard, now time.Time) (map[string]int64, error) {
	p, ok := s.cat.Product(c.ProductID)
	if !ok {
		return nil, nil
	}
	type capDef struct {
		key, period string
		cats        []string
	}
	var caps []capDef
	for _, r := range p.Rules {
		if r.CapCents > 0 {
			caps = append(caps, capDef{capKeyOf(r), r.CapPeriod, []string{r.Category}})
		}
	}
	if ch := p.ChoiceCategory; ch != nil {
		key := ch.CapGroup
		if key == "" {
			key = "choice"
		}
		caps = append(caps, capDef{key, ch.CapPeriod, c.Choices})
	}
	if p.Rotating != nil {
		caps = append(caps, capDef{"rotating", p.Rotating.CapPeriod, c.RotatingActive})
	}
	if p.TopCategory != nil {
		caps = append(caps, capDef{"top", p.TopCategory.CapPeriod, p.TopCategory.Eligible})
	}
	if len(caps) == 0 {
		return nil, nil
	}
	rows, err := s.st.DB.QueryContext(ctx, `SELECT category, amount_cents, created_at FROM "transaction"
		WHERE card_id = ? AND state = 'SUCCEEDED' AND created_at >= ?`, c.ID, periodStart("year", now).Format(time.RFC3339Nano))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	spent := map[string]int64{}
	for rows.Next() {
		var cat, created string
		var amt int64
		if err := rows.Scan(&cat, &amt, &created); err != nil {
			return nil, err
		}
		at := store.ParseTime(created)
		rcats := s.cat.RewardCategories(cat)
		for _, cp := range caps {
			if at.Before(periodStart(cp.period, now)) {
				continue
			}
			for _, rc := range rcats {
				if slices.Contains(cp.cats, rc) {
					spent[cp.key] += amt
					break
				}
			}
		}
	}
	return spent, rows.Err()
}

func capKeyOf(r rewards.Rule) string {
	if r.CapGroup != "" {
		return r.CapGroup
	}
	return r.Category
}

func periodStart(period string, now time.Time) time.Time {
	y, m, _ := now.Date()
	switch period {
	case "month":
		return time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
	case "quarter":
		return time.Date(y, ((m-1)/3)*3+1, 1, 0, 0, 0, 0, time.UTC)
	default:
		return time.Date(y, 1, 1, 0, 0, 0, 0, time.UTC)
	}
}
