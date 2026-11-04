package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sort"
	"strconv"
	"time"

	"cardstack/server/internal/plaid"
	"cardstack/server/internal/rewards"
	"cardstack/server/internal/store"
)

type plaidItem = plaid.Item

func (s *Server) handleLinkToken(w http.ResponseWriter, r *http.Request) {
	tok := s.plaid.CreateLinkToken(userID(r))
	writeJSON(w, http.StatusOK, map[string]any{
		"linkToken": tok,
		"linkUrl":   s.cfg.PublicURL + "/sandbox/link?token=" + tok,
	})
}

func (s *Server) handleInstitutions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"institutions": s.plaid.Institutions()})
}

type connectBody struct {
	UserID        string `json:"userId"`
	PublicToken   string `json:"publicToken"`
	InstitutionID string `json:"institutionId"`
	Success       bool   `json:"success"`
}

// handleSandboxComplete is called by the mock Plaid Link page when the consumer
// finishes. Like Plaid, it then delivers a signed webhook to /connect-bank-account,
// so the signature check (REQ-06, EC-05) runs on every link.
func (s *Server) handleSandboxComplete(w http.ResponseWriter, r *http.Request) {
	var body struct {
		LinkToken     string   `json:"linkToken"`
		InstitutionID string   `json:"institutionId"`
		AccountIDs    []string `json:"accountIds"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	uid, ok := s.plaid.LinkUser(body.LinkToken)
	if !ok {
		writeErr(w, http.StatusBadRequest, "BadInput", "unknown or expired link token")
		return
	}
	pub, err := s.plaid.CreatePublicToken(body.LinkToken, body.InstitutionID, body.AccountIDs)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "BadInput", err.Error())
		return
	}
	payload, _ := json.Marshal(connectBody{UserID: uid, PublicToken: pub, InstitutionID: body.InstitutionID, Success: true})
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, s.cfg.PublicURL+"/server/v1/connect-bank-account", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Plaid-Verification", s.plaid.SignWebhook(payload))
	resp, err := s.http.Do(req)
	if err != nil {
		writeErr(w, http.StatusBadGateway, "AddInstitutionError", "could not deliver link result")
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// handleConnectBankAccount is the Plaid webhook (I9). Nothing is stored unless
// the signature verifies.
func (s *Server) handleConnectBankAccount(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "BadInput", "unreadable body")
		return
	}
	if !s.plaid.VerifyWebhook(raw, r.Header.Get("Plaid-Verification")) {
		s.log.Warn("rejected Plaid webhook with invalid signature", "remote", r.RemoteAddr)
		writeErr(w, http.StatusBadRequest, "BadInput", "invalid signature")
		return
	}
	var body connectBody
	if json.Unmarshal(raw, &body) != nil || body.UserID == "" || body.PublicToken == "" {
		writeErr(w, http.StatusBadRequest, "BadInput", "missing fields")
		return
	}
	if !body.Success {
		writeErr(w, http.StatusBadGateway, "AddInstitutionError", "link was not completed")
		return
	}
	if _, err := s.st.UserByID(r.Context(), body.UserID); err != nil {
		writeErr(w, http.StatusBadRequest, "BadInput", "unknown user")
		return
	}
	item, err := s.plaid.Exchange(body.PublicToken)
	if err != nil {
		writeErr(w, http.StatusBadGateway, "AddInstitutionError", err.Error())
		return
	}
	added, err := s.saveItem(r, body.UserID, item)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "cardsAdded": added, "redirectUrl": s.cfg.PublicURL + "/sandbox/link?done=1"})
}

func (s *Server) saveItem(r *http.Request, uid string, item plaidItem) (int, error) {
	ctx := r.Context()
	tx, err := s.st.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	linkID := store.NewID()
	now := store.Now()
	if _, err := tx.ExecContext(ctx, `INSERT INTO institution_link (id, user_id, plaid_item_id, institution_id, institution, status, created_at)
		VALUES (?,?,?,?,?,'active',?)`, linkID, uid, item.ItemID, item.Institution.ID, item.Institution.Name, now); err != nil {
		return 0, err
	}
	added := 0
	for _, a := range item.Institution.Accounts {
		var exists int
		err := tx.QueryRowContext(ctx, `SELECT 1 FROM user_card WHERE user_id = ? AND plaid_account_id = ? AND active = 1
			UNION SELECT 1 FROM linked_account WHERE user_id = ? AND plaid_account_id = ?`, uid, a.AccountID, uid, a.AccountID).Scan(&exists)
		if err == nil {
			continue // already linked
		} else if !errors.Is(err, sql.ErrNoRows) {
			return 0, err
		}
		if a.Type == "credit" {
			sealed := s.st.Seal(item.ProcessorTokens[a.AccountID])
			if _, err := tx.ExecContext(ctx, `INSERT INTO user_card (id, user_id, institution_link_id, plaid_account_id, card_product_id,
				processor_token, last4, network, nickname, expires_at, credit_limit_cents, balance_cents, created_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, store.NewID(), uid, linkID, a.AccountID, a.CardProductID, sealed,
				a.Mask, a.Network, a.Name, a.ExpiresAt, a.CreditLimitCents, a.BalanceCents, now); err != nil {
				return 0, err
			}
			added++
		} else {
			if _, err := tx.ExecContext(ctx, `INSERT INTO linked_account (id, user_id, institution_link_id, plaid_account_id, name, type, subtype, mask, balance_cents)
				VALUES (?,?,?,?,?,?,?,?,?)`, store.NewID(), uid, linkID, a.AccountID, a.Name, a.Type, a.Subtype, a.Mask, a.BalanceCents); err != nil {
				return 0, err
			}
		}
	}
	for _, t := range item.Transactions {
		if _, err := tx.ExecContext(ctx, `INSERT INTO external_transaction (id, user_id, account_ref, date, merchant, category, amount_cents)
			VALUES (?,?,?,?,?,?,?)`, store.NewID(), uid, t.AccountID, t.Date, t.Merchant, t.Category, t.AmountCents); err != nil {
			return 0, err
		}
	}
	return added, tx.Commit()
}

// ---- financial aggregator -------------------------------------------------

func (s *Server) handleAccounts(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	cards, err := s.st.Cards(r.Context(), uid)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	rows, err := s.st.DB.QueryContext(r.Context(), `SELECT a.id, a.name, a.subtype, a.mask, a.balance_cents, l.institution
		FROM linked_account a JOIN institution_link l ON l.id = a.institution_link_id WHERE a.user_id = ? ORDER BY l.institution, a.name`, uid)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	defer rows.Close()
	type acct struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		Subtype      string `json:"subtype"`
		Mask         string `json:"mask"`
		BalanceCents int64  `json:"balanceCents"`
		Institution  string `json:"institution"`
	}
	accounts := []acct{}
	var cash, debt, limit int64
	for rows.Next() {
		var a acct
		if err := rows.Scan(&a.ID, &a.Name, &a.Subtype, &a.Mask, &a.BalanceCents, &a.Institution); err != nil {
			s.storeErr(w, err)
			return
		}
		cash += a.BalanceCents
		accounts = append(accounts, a)
	}
	views := make([]cardView, 0, len(cards))
	for _, c := range cards {
		debt += c.BalanceCents
		limit += c.CreditLimitCents
		views = append(views, s.view(c))
	}
	util := 0.0
	if limit > 0 {
		util = float64(debt) / float64(limit)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"cards":    views,
		"accounts": accounts,
		"totals": map[string]any{
			"cashCents": cash, "creditBalanceCents": debt, "creditLimitCents": limit,
			"utilization": util, "netCents": cash - debt,
		},
	})
}

type extTx struct {
	ID          string `json:"id"`
	AccountRef  string `json:"accountRef"`
	Date        string `json:"date"`
	Merchant    string `json:"merchant"`
	Category    string `json:"category"`
	AmountCents int64  `json:"amountCents"`
}

func (s *Server) externalSince(r *http.Request, uid string, since string) ([]extTx, error) {
	rows, err := s.st.DB.QueryContext(r.Context(), `SELECT id, account_ref, date, merchant, category, amount_cents
		FROM external_transaction WHERE user_id = ? AND date >= ? ORDER BY date DESC, id`, uid, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []extTx
	for rows.Next() {
		var t extTx
		if err := rows.Scan(&t.ID, &t.AccountRef, &t.Date, &t.Merchant, &t.Category, &t.AmountCents); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Server) handleExternalTransactions(w http.ResponseWriter, r *http.Request) {
	limit, offset := pageParams(r)
	all, err := s.externalSince(r, userID(r), "0000")
	if err != nil {
		s.storeErr(w, err)
		return
	}
	end := min(offset+limit, len(all))
	page := []extTx{}
	if offset < len(all) {
		page = all[offset:end]
	}
	next := ""
	if end < len(all) {
		next = strconv.Itoa(end)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": page, "nextCursor": next})
}

func pageParams(r *http.Request) (limit, offset int) {
	limit, _ = strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20 // REQ-11
	}
	offset, _ = strconv.Atoi(r.URL.Query().Get("cursor"))
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// handleInsights summarizes spending from linked accounts: totals by category,
// top merchants, and how much more the consumer would have earned if every
// card purchase had gone on their best card.
func (s *Server) handleInsights(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 365 {
		days = 30
	}
	since := s.nowFunc().UTC().AddDate(0, 0, -days).Format("2006-01-02")
	txs, err := s.externalSince(r, uid, since)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	cards, err := s.st.Cards(r.Context(), uid)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	byAccount := map[string]store.UserCard{}
	var rc []rewards.Card
	for _, c := range cards {
		var acct string
		s.st.DB.QueryRowContext(r.Context(), `SELECT plaid_account_id FROM user_card WHERE id = ?`, c.ID).Scan(&acct)
		byAccount[acct] = c
		rc = append(rc, rewards.Card{ID: c.ID, ProductID: c.ProductID, Last4: c.Last4, Status: "active", Preferred: c.Preferred,
			CreatedAt: store.ParseTime(c.CreatedAt), Context: rewards.CardContext{Choices: c.Choices, RotatingActive: c.RotatingActive}})
	}

	type catStat struct {
		Category      string  `json:"category"`
		SpentCents    int64   `json:"spentCents"`
		Count         int     `json:"count"`
		BestCardID    string  `json:"bestCardId,omitempty"`
		BestCardName  string  `json:"bestCardName,omitempty"`
		BestRate      float64 `json:"bestRate,omitempty"`
		EarnedCents   int64   `json:"earnedCents"`
		PossibleCents int64   `json:"possibleCents"`
	}
	cats := map[string]*catStat{}
	merchants := map[string]int64{}
	var total, earned, possible int64
	for _, t := range txs {
		total += t.AmountCents
		merchants[t.Merchant] += t.AmountCents
		cs := cats[t.Category]
		if cs == nil {
			cs = &catStat{Category: t.Category}
			cats[t.Category] = cs
		}
		cs.SpentCents += t.AmountCents
		cs.Count++
		used, onCard := byAccount[t.AccountRef]
		if !onCard || len(rc) == 0 {
			continue
		}
		// Caps are ignored here; this is an estimate of the opportunity, not a statement.
		ranked, _ := s.cat.Select(rc, t.AmountCents, t.Category, "", s.nowFunc())
		if len(ranked) == 0 {
			continue
		}
		var usedValue int64
		for _, rk := range ranked {
			if rk.CardID == used.ID {
				usedValue = rk.ExpectedValueCents
			}
		}
		cs.EarnedCents += usedValue
		cs.PossibleCents += ranked[0].ExpectedValueCents
		cs.BestCardID, cs.BestCardName, cs.BestRate = ranked[0].CardID, ranked[0].ProductName, ranked[0].Rate
		earned += usedValue
		possible += ranked[0].ExpectedValueCents
	}
	catList := make([]*catStat, 0, len(cats))
	for _, c := range cats {
		catList = append(catList, c)
	}
	sort.Slice(catList, func(i, j int) bool { return catList[i].SpentCents > catList[j].SpentCents })
	type merch struct {
		Merchant   string `json:"merchant"`
		SpentCents int64  `json:"spentCents"`
	}
	ml := make([]merch, 0, len(merchants))
	for m, v := range merchants {
		ml = append(ml, merch{m, v})
	}
	sort.Slice(ml, func(i, j int) bool { return ml[i].SpentCents > ml[j].SpentCents })
	if len(ml) > 5 {
		ml = ml[:5]
	}

	var csEarned int64
	s.st.DB.QueryRowContext(r.Context(), `SELECT COALESCE(SUM(points_earned_cents),0) FROM "transaction" WHERE user_id = ? AND state = 'SUCCEEDED'`, uid).Scan(&csEarned)

	writeJSON(w, http.StatusOK, map[string]any{
		"days": days, "since": since, "totalSpentCents": total,
		"categories": catList, "topMerchants": ml,
		"rewards": map[string]any{
			"earnedCents": earned, "possibleCents": possible, "missedCents": possible - earned,
			"cardstackEarnedCents": csEarned,
		},
		"generatedAt": s.nowFunc().UTC().Format(time.RFC3339),
	})
}
