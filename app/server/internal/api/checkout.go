package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"cardstack/server/internal/processor"
	"cardstack/server/internal/rewards"
	"cardstack/server/internal/store"
)

// Transaction states (Requirements Document glossary; D2 Figure 2).
const (
	Initiated     = "INITIATED"
	Authenticated = "AUTHENTICATED"
	CardSelected  = "CARD_SELECTED"
	Processing    = "PROCESSING"
	Unknown       = "UNKNOWN"
	Succeeded     = "SUCCEEDED"
	Failed        = "FAILED"
	Abandoned     = "ABANDONED"
)

func terminal(state string) bool { return state == Succeeded || state == Failed || state == Abandoned }

type txRow struct {
	ID, UserID, CardID, MerchantID, MerchantName, MerchantBrand, OrderID, Category, State, ErrorCode, ReturnURL, CreatedAt string
	AmountCents, PointsCents                                                                                               int64
}

func (s *Server) loadTx(ctx context.Context, id string) (txRow, error) {
	var t txRow
	err := s.st.DB.QueryRowContext(ctx, `SELECT t.id, COALESCE(t.user_id,''), COALESCE(t.card_id,''), t.merchant_id, m.name, COALESCE(m.brand,''),
		t.order_id, t.category, t.state, COALESCE(t.error_code,''), COALESCE(t.return_url,''), t.created_at, t.amount_cents, t.points_earned_cents
		FROM "transaction" t JOIN merchant m ON m.id = t.merchant_id WHERE t.id = ?`, id).Scan(
		&t.ID, &t.UserID, &t.CardID, &t.MerchantID, &t.MerchantName, &t.MerchantBrand, &t.OrderID, &t.Category, &t.State,
		&t.ErrorCode, &t.ReturnURL, &t.CreatedAt, &t.AmountCents, &t.PointsCents)
	if errors.Is(err, sql.ErrNoRows) {
		return t, store.ErrNotFound
	}
	return t, err
}

func (s *Server) cardLast4(ctx context.Context, cardID string) string {
	var l string
	s.st.DB.QueryRowContext(ctx, `SELECT last4 FROM user_card WHERE id = ?`, cardID).Scan(&l)
	return l
}

func (s *Server) setState(ctx context.Context, id, state, errCode string) error {
	var ec any
	if errCode != "" {
		ec = errCode
	}
	_, err := s.st.DB.ExecContext(ctx, `UPDATE "transaction" SET state = ?, error_code = ?, updated_at = ? WHERE id = ?`, state, ec, store.Now(), id)
	return err
}

// finish moves a transaction to a terminal state and queues the merchant
// webhook (REQ-09) and, on success, the receipt (REQ-13).
func (s *Server) finish(ctx context.Context, t txRow, state, errCode string) error {
	if err := s.setState(ctx, t.ID, state, errCode); err != nil {
		return err
	}
	if _, err := s.st.DB.ExecContext(ctx, `INSERT INTO webhook_delivery (id, transaction_id, next_retry_at, status) VALUES (?,?,?,'pending')`,
		store.NewID(), t.ID, store.Now()); err != nil {
		return err
	}
	if state == Succeeded && t.UserID != "" {
		if u, err := s.st.UserByID(ctx, t.UserID); err == nil {
			s.st.DB.ExecContext(ctx, `INSERT INTO notification (id, transaction_id, user_id, type, email, status, created_at) VALUES (?,?,?,'receipt',?,'pending',?)`,
				store.NewID(), t.ID, t.UserID, u.Email, store.Now())
		}
	}
	return nil
}

// ---- Checkout Button (I1) ---------------------------------------------------

func (s *Server) handleButton(w http.ResponseWriter, r *http.Request) {
	var merchantID, merchantName, domain, display string
	err := s.st.DB.QueryRowContext(r.Context(), `SELECT b.merchant_id, m.name, b.allowed_domain, b.display_config
		FROM checkout_button b JOIN merchant m ON m.id = b.merchant_id WHERE b.button_id = ?`, r.PathValue("id")).Scan(&merchantID, &merchantName, &domain, &display)
	origin := r.Header.Get("Origin")
	if errors.Is(err, sql.ErrNoRows) || origin == "" || !strings.EqualFold(hostOf(origin), domain) {
		writeErr(w, http.StatusForbidden, "ButtonNotAllowed", "button not registered for this site")
		return
	}
	if err != nil {
		s.storeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"buttonId": r.PathValue("id"), "merchantId": merchantID, "merchantName": merchantName,
		"displayConfig": jsonRaw(display)})
}

type jsonRaw string

func (j jsonRaw) MarshalJSON() ([]byte, error) {
	if j == "" {
		return []byte("{}"), nil
	}
	return []byte(j), nil
}

// merchantAuth checks a merchant secret API key (Authorization: Bearer msk_...).
func (s *Server) merchantAuth(r *http.Request) (string, bool) {
	key := bearer(r)
	if key == "" {
		return "", false
	}
	var id string
	err := s.st.DB.QueryRowContext(r.Context(), `SELECT id FROM merchant WHERE api_key_hash = ?`, store.HashToken(key)).Scan(&id)
	return id, err == nil
}

// handleCreateCheckoutSession is called by the merchant's server so the amount
// cannot be changed in the shopper's browser.
func (s *Server) handleCreateCheckoutSession(w http.ResponseWriter, r *http.Request) {
	merchantID, ok := s.merchantAuth(r)
	if !ok {
		writeErr(w, http.StatusUnauthorized, "MerchantAuth", "invalid merchant API key")
		return
	}
	var body struct {
		ButtonID    string `json:"buttonId"`
		OrderID     string `json:"orderId"`
		AmountCents int64  `json:"amountCents"`
		Category    string `json:"category"`
		ReturnURL   string `json:"returnUrl"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.OrderID == "" || body.AmountCents <= 0 || body.AmountCents > 10_000_000 {
		writeErr(w, http.StatusBadRequest, "BadInput", "orderId and a positive amountCents are required")
		return
	}
	var domain string
	err := s.st.DB.QueryRowContext(r.Context(), `SELECT allowed_domain FROM checkout_button WHERE button_id = ? AND merchant_id = ?`,
		body.ButtonID, merchantID).Scan(&domain)
	if err != nil {
		writeErr(w, http.StatusForbidden, "ButtonNotAllowed", "button does not belong to this merchant")
		return
	}
	if u, err := url.Parse(body.ReturnURL); err != nil || !strings.EqualFold(u.Host, domain) {
		writeErr(w, http.StatusBadRequest, "BadInput", "returnUrl must be on the button's allowed domain")
		return
	}
	if body.Category == "" {
		body.Category = "General"
	}
	// Reuse an open session for the same order instead of creating a second one.
	var existing string
	err = s.st.DB.QueryRowContext(r.Context(), `SELECT id FROM "transaction" WHERE merchant_id = ? AND order_id = ?
		AND state NOT IN ('FAILED','ABANDONED') ORDER BY created_at DESC LIMIT 1`, merchantID, body.OrderID).Scan(&existing)
	if err == nil {
		writeJSON(w, http.StatusOK, map[string]any{"transactionId": existing, "checkoutUrl": s.cfg.PublicURL + "/checkout/" + existing})
		return
	}
	id := store.NewID()
	now := store.Now()
	if _, err := s.st.DB.ExecContext(r.Context(), `INSERT INTO "transaction" (id, merchant_id, order_id, amount_cents, category, state, return_url, created_at, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?)`, id, merchantID, body.OrderID, body.AmountCents, body.Category, Initiated, body.ReturnURL, now, now); err != nil {
		s.storeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"transactionId": id, "checkoutUrl": s.cfg.PublicURL + "/checkout/" + id})
}

func (s *Server) handleMerchantTransaction(w http.ResponseWriter, r *http.Request) {
	merchantID, ok := s.merchantAuth(r)
	if !ok {
		writeErr(w, http.StatusUnauthorized, "MerchantAuth", "invalid merchant API key")
		return
	}
	t, err := s.loadTx(r.Context(), r.PathValue("id"))
	if err != nil || t.MerchantID != merchantID {
		writeErr(w, http.StatusNotFound, "NotFound", "transaction not found")
		return
	}
	writeJSON(w, http.StatusOK, s.result(r.Context(), t))
}

// result is the payment result returned to the merchant (REQ-07).
func (s *Server) result(ctx context.Context, t txRow) map[string]any {
	status := "pending"
	switch t.State {
	case Succeeded:
		status = "approved"
	case Failed, Abandoned:
		status = "declined"
	}
	out := map[string]any{"transactionId": t.ID, "orderId": t.OrderID, "state": t.State, "status": status, "amountCents": t.AmountCents}
	if t.ErrorCode != "" {
		out["reason"] = t.ErrorCode
	}
	if t.CardID != "" {
		out["cardLast4"] = s.cardLast4(ctx, t.CardID)
	}
	return out
}

// handleCheckoutInfo gives the Checkout Interface what to show (REQ-03).
func (s *Server) handleCheckoutInfo(w http.ResponseWriter, r *http.Request) {
	t, err := s.loadTx(r.Context(), r.PathValue("id"))
	if err != nil {
		s.storeErr(w, err)
		return
	}
	res := s.result(r.Context(), t)
	res["merchantName"], res["category"], res["returnUrl"] = t.MerchantName, t.Category, t.ReturnURL
	res["pointsEarnedCents"] = t.PointsCents
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) ownTx(w http.ResponseWriter, r *http.Request, id string) (txRow, bool) {
	t, err := s.loadTx(r.Context(), id)
	if err != nil {
		s.storeErr(w, err)
		return t, false
	}
	uid := userID(r)
	if t.UserID == "" && !terminal(t.State) {
		// The first signed-in consumer to open the checkout claims it.
		res, err := s.st.DB.ExecContext(r.Context(), `UPDATE "transaction" SET user_id = ?, state = ?, updated_at = ? WHERE id = ? AND user_id IS NULL`,
			uid, Authenticated, store.Now(), t.ID)
		if err != nil {
			s.storeErr(w, err)
			return t, false
		}
		if n, _ := res.RowsAffected(); n == 1 {
			t.UserID, t.State = uid, Authenticated
		} else {
			t, _ = s.loadTx(r.Context(), id)
		}
	}
	if t.UserID != uid {
		writeErr(w, http.StatusForbidden, "Forbidden", "this checkout belongs to another account")
		return t, false
	}
	return t, true
}

func (s *Server) declinedCards(ctx context.Context, txID string) (map[string]bool, int, error) {
	rows, err := s.st.DB.QueryContext(ctx, `SELECT card_id, status FROM charge_attempt WHERE transaction_id = ?`, txID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := map[string]bool{}
	n := 0
	for rows.Next() {
		var c, st string
		rows.Scan(&c, &st)
		n++
		if st == string(processor.Declined) {
			out[c] = true
		}
	}
	return out, n, rows.Err()
}

func (s *Server) eligibleRanking(ctx context.Context, t txRow) ([]rewards.Ranked, []rewards.Excluded, error) {
	ranked, excluded, err := s.rank(ctx, t.UserID, t.AmountCents, t.Category, t.MerchantBrand)
	if err != nil {
		return nil, nil, err
	}
	declined, _, err := s.declinedCards(ctx, t.ID)
	if err != nil {
		return nil, nil, err
	}
	var keep []rewards.Ranked
	for _, rk := range ranked {
		if declined[rk.CardID] {
			excluded = append(excluded, rewards.Excluded{CardID: rk.CardID, Reason: "declined for this purchase"})
			continue
		}
		keep = append(keep, rk)
	}
	return keep, excluded, nil
}

// handleSelectCard returns the ranked card list for a checkout (I3, REQ-04).
func (s *Server) handleSelectCard(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TransactionID string `json:"transactionId"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	t, ok := s.ownTx(w, r, body.TransactionID)
	if !ok {
		return
	}
	if terminal(t.State) || t.State == Processing || t.State == Unknown {
		writeJSON(w, http.StatusConflict, map[string]any{"error": "Duplicate", "message": "this checkout is already " + strings.ToLower(t.State), "result": s.result(r.Context(), t)})
		return
	}
	ranked, excluded, err := s.eligibleRanking(r.Context(), t)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	if len(ranked) == 0 {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "E-SEL-NO-CARD", "message": "no eligible linked card", "excluded": excluded})
		return
	}
	s.setState(r.Context(), t.ID, CardSelected, "")
	writeJSON(w, http.StatusOK, map[string]any{
		"transactionId": t.ID, "merchantName": t.MerchantName, "amountCents": t.AmountCents, "category": t.Category,
		"ranked": ranked, "excluded": excluded,
	})
}

// handleProcessPayment charges the selected card (I5, REQ-05, REQ-08, REQ-10).
func (s *Server) handleProcessPayment(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TransactionID     string `json:"transactionId"`
		CardID            string `json:"cardId"`
		ConsentToFallback bool   `json:"consentToFallback"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.TransactionID == "" {
		body.TransactionID = r.Header.Get("Idempotency-Key")
	}
	ctx := r.Context()
	t, ok := s.ownTx(w, r, body.TransactionID)
	if !ok {
		return
	}
	if terminal(t.State) || t.State == Processing || t.State == Unknown {
		// A repeated submission returns the first result and never charges again.
		writeJSON(w, http.StatusConflict, map[string]any{"error": "Duplicate", "result": s.result(ctx, t)})
		return
	}
	ranked, _, err := s.eligibleRanking(ctx, t)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	if len(ranked) == 0 {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "E-SEL-NO-CARD", "message": "no eligible linked card"})
		return
	}
	declined, attempts, err := s.declinedCards(ctx, t.ID)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	if len(declined) > 0 && !body.ConsentToFallback {
		writeErr(w, http.StatusBadRequest, "ConsentRequired", "ask the consumer before charging another card")
		return
	}
	chosen := ranked[0]
	if body.CardID != "" {
		found := false
		for _, rk := range ranked {
			if rk.CardID == body.CardID {
				chosen, found = rk, true
			}
		}
		if !found {
			writeErr(w, http.StatusBadRequest, "BadInput", "that card is not eligible for this purchase")
			return
		}
	}

	// Claim the transaction so a double click cannot start two charges.
	res, err := s.st.DB.ExecContext(ctx, `UPDATE "transaction" SET state = ?, card_id = ?, error_code = NULL, updated_at = ?
		WHERE id = ? AND state IN (?, ?)`, Processing, chosen.CardID, store.Now(), t.ID, Authenticated, CardSelected)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	if n, _ := res.RowsAffected(); n != 1 {
		t, _ = s.loadTx(ctx, t.ID)
		writeJSON(w, http.StatusConflict, map[string]any{"error": "Duplicate", "result": s.result(ctx, t)})
		return
	}
	t.CardID = chosen.CardID
	s.st.DB.ExecContext(ctx, `INSERT INTO selection_log (transaction_id, chosen_card_id, rule_id, reason, created_at) VALUES (?,?,?,?,?)`,
		t.ID, chosen.CardID, chosen.Rule, chosen.Reason, store.Now())

	card, err := s.st.Card(ctx, t.UserID, chosen.CardID)
	if err != nil {
		s.finish(ctx, t, Failed, "StoreUnavailable")
		s.storeErr(w, err)
		return
	}
	tok, err := s.st.Unseal(card.ProcessorToken)
	if err != nil {
		s.finish(ctx, t, Failed, "CardProcessTransactionError")
		writeErr(w, http.StatusBadGateway, "CardProcessTransactionError", "card token unavailable")
		return
	}
	key := t.ID
	if attempts > 0 {
		key = fmt.Sprintf("%s:%d", t.ID, attempts+1)
	}
	attemptID := store.NewID()
	s.st.DB.ExecContext(ctx, `INSERT INTO charge_attempt (id, transaction_id, card_id, idempotency_key, status, created_at) VALUES (?,?,?,?,'pending',?)`,
		attemptID, t.ID, chosen.CardID, key, store.Now())

	cctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), s.cfg.ChargeTimeout)
	charge, err := s.proc.Charge(cctx, tok, t.AmountCents, "usd", key)
	cancel()

	switch {
	case errors.Is(err, processor.ErrTimeout):
		// REQ-10: the reconciliation job resolves UNKNOWN within 15 minutes.
		s.st.DB.ExecContext(ctx, `UPDATE charge_attempt SET status = 'unknown' WHERE id = ?`, attemptID)
		s.setState(ctx, t.ID, Unknown, "")
		writeJSON(w, http.StatusAccepted, map[string]any{"success": false, "transactionId": t.ID, "state": Unknown,
			"cardLast4": card.Last4, "message": "waiting for the card processor to confirm"})
	case err != nil:
		s.st.DB.ExecContext(ctx, `UPDATE charge_attempt SET status = 'error' WHERE id = ?`, attemptID)
		s.finish(ctx, t, Failed, "CardProcessTransactionError")
		writeErr(w, http.StatusBadGateway, "CardProcessTransactionError", "card processor error")
	case charge.Status == processor.Succeeded:
		s.recordSuccess(ctx, t, attemptID, charge, chosen.ExpectedValueCents)
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "transactionId": t.ID, "state": Succeeded,
			"cardLast4": card.Last4, "pointsEarnedCents": chosen.ExpectedValueCents, "returnUrl": t.ReturnURL, "error": nil})
	default:
		s.st.DB.ExecContext(ctx, `UPDATE charge_attempt SET status = 'declined', charge_id = ? WHERE id = ?`, charge.ID, attemptID)
		var next *rewards.Ranked
		for i := range ranked {
			if ranked[i].CardID != chosen.CardID {
				next = &ranked[i]
				break
			}
		}
		resp := map[string]any{"success": false, "transactionId": t.ID, "error": "CardProcessTransactionError",
			"declinedCard": map[string]string{"cardId": card.ID, "last4": card.Last4, "network": card.Network}}
		if next != nil {
			// REQ-08: wait for the consumer's permission before charging the next card.
			s.setState(ctx, t.ID, CardSelected, "CardProcessTransactionError")
			resp["state"], resp["nextCard"] = CardSelected, next
		} else {
			s.finish(ctx, t, Failed, "CardDeclined")
			resp["state"], resp["returnUrl"] = Failed, t.ReturnURL
		}
		writeJSON(w, http.StatusBadGateway, resp)
	}
}

func (s *Server) recordSuccess(ctx context.Context, t txRow, attemptID string, charge processor.Charge, points int64) {
	s.st.DB.ExecContext(ctx, `UPDATE charge_attempt SET status = 'succeeded', charge_id = ? WHERE id = ?`, charge.ID, attemptID)
	s.st.DB.ExecContext(ctx, `UPDATE "transaction" SET charge_id = ?, points_earned_cents = ? WHERE id = ?`, charge.ID, points, t.ID)
	s.st.DB.ExecContext(ctx, `UPDATE user_card SET balance_cents = balance_cents + ? WHERE id = ?`, t.AmountCents, t.CardID)
	if err := s.finish(ctx, t, Succeeded, ""); err != nil {
		s.log.Error("finish", "tx", t.ID, "err", err)
	}
}

func (s *Server) handleCheckoutCancel(w http.ResponseWriter, r *http.Request) {
	t, ok := s.ownTx(w, r, r.PathValue("id"))
	if !ok {
		return
	}
	if terminal(t.State) || t.State == Processing || t.State == Unknown {
		writeJSON(w, http.StatusConflict, map[string]any{"error": "Duplicate", "result": s.result(r.Context(), t)})
		return
	}
	code := "ConsumerCancelled"
	if t.ErrorCode != "" {
		code = "CardDeclined"
	}
	if err := s.finish(r.Context(), t, Abandoned, code); err != nil {
		s.storeErr(w, err)
		return
	}
	t, _ = s.loadTx(r.Context(), t.ID)
	writeJSON(w, http.StatusOK, s.result(r.Context(), t))
}

// handleTransactions is the consumer's CardStack transaction history (I10, REQ-11).
func (s *Server) handleTransactions(w http.ResponseWriter, r *http.Request) {
	limit, offset := pageParams(r)
	rows, err := s.st.DB.QueryContext(r.Context(), `SELECT t.id, m.name, t.amount_cents, t.created_at, COALESCE(c.last4,''), t.points_earned_cents, t.state, t.category
		FROM "transaction" t JOIN merchant m ON m.id = t.merchant_id LEFT JOIN user_card c ON c.id = t.card_id
		WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT ? OFFSET ?`, userID(r), limit+1, offset)
	if err != nil {
		s.storeErr(w, err)
		return
	}
	defer rows.Close()
	type item struct {
		TransactionID string `json:"transactionId"`
		Merchant      string `json:"merchant"`
		AmountCents   int64  `json:"amountCents"`
		CreatedAt     string `json:"createdAt"`
		CardLast4     string `json:"cardLast4"`
		PointsEarned  int64  `json:"pointsEarnedCents"`
		State         string `json:"state"`
		Category      string `json:"category"`
	}
	items := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.TransactionID, &it.Merchant, &it.AmountCents, &it.CreatedAt, &it.CardLast4, &it.PointsEarned, &it.State, &it.Category); err != nil {
			s.storeErr(w, err)
			return
		}
		items = append(items, it)
	}
	next := ""
	if len(items) > limit {
		items = items[:limit]
		next = strconv.Itoa(offset + limit)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": next})
}
