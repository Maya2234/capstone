package api

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"cardstack/server/internal/processor"
	"cardstack/server/internal/store"
)

const maxWebhookAttempts = 5

// RunWorkers runs the background jobs in the API process (Technical
// Specification §2): merchant webhooks, reconciliation, receipts, and
// abandoning stale checkouts. It returns when ctx is cancelled.
func (s *Server) RunWorkers(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.Tick(ctx)
		}
	}
}

// Tick runs each job once. Tests call it directly.
func (s *Server) Tick(ctx context.Context) {
	s.reconcile(ctx)
	s.abandonStale(ctx)
	s.deliverWebhooks(ctx)
	s.sendReceipts(ctx)
}

// SignPayload is the X-CardStack-Signature for a merchant webhook body.
func SignPayload(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *Server) deliverWebhooks(ctx context.Context) {
	rows, err := s.st.DB.QueryContext(ctx, `SELECT d.id, d.transaction_id, d.attempts, m.id, m.webhook_url, m.webhook_secret
		FROM webhook_delivery d JOIN "transaction" t ON t.id = d.transaction_id JOIN merchant m ON m.id = t.merchant_id
		WHERE d.status = 'pending' AND d.next_retry_at <= ? ORDER BY d.next_retry_at LIMIT 20`, store.Now())
	if err != nil {
		s.log.Error("webhook query", "err", err)
		return
	}
	type job struct {
		id, txID, merchantID, url, secret string
		attempts                          int
	}
	var jobs []job
	for rows.Next() {
		var j job
		if rows.Scan(&j.id, &j.txID, &j.attempts, &j.merchantID, &j.url, &j.secret) == nil {
			jobs = append(jobs, j)
		}
	}
	rows.Close()

	for _, j := range jobs {
		t, err := s.loadTx(ctx, j.txID)
		if err != nil {
			continue
		}
		payload, _ := json.Marshal(map[string]any{
			"orderId": t.OrderID, "transactionId": t.ID, "state": t.State, "amountCents": t.AmountCents,
			"timestamp": time.Now().UTC().Format(time.RFC3339), "reason": t.ErrorCode,
		})
		err = s.post(ctx, j.url, payload, j.secret)
		attempts := j.attempts + 1
		switch {
		case err == nil:
			s.st.DB.ExecContext(ctx, `UPDATE webhook_delivery SET status = 'delivered', attempts = ?, last_error = NULL WHERE id = ?`, attempts, j.id)
		case attempts >= maxWebhookAttempts:
			s.st.DB.ExecContext(ctx, `UPDATE webhook_delivery SET status = 'failed', attempts = ?, last_error = ? WHERE id = ?`, attempts, err.Error(), j.id)
			s.st.DB.ExecContext(ctx, `UPDATE merchant SET flagged = 1 WHERE id = ?`, j.merchantID)
			s.log.Warn("merchant flagged after failed webhooks", "merchant", j.merchantID, "tx", j.txID)
		default:
			delay := s.cfg.WebhookBackoff << (attempts - 1) // exponential backoff
			s.st.DB.ExecContext(ctx, `UPDATE webhook_delivery SET attempts = ?, next_retry_at = ?, last_error = ? WHERE id = ?`,
				attempts, time.Now().UTC().Add(delay).Format(time.RFC3339Nano), err.Error(), j.id)
		}
	}
}

func (s *Server) post(ctx context.Context, url string, body []byte, secret string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CardStack-Signature", SignPayload(secret, body))
	resp, err := s.http.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("merchant returned %d", resp.StatusCode)
	}
	return nil
}

// reconcile asks the processor for the final result of UNKNOWN charges (REQ-10).
// A charge the processor has no record of after 15 minutes is marked FAILED (NFR-09).
func (s *Server) reconcile(ctx context.Context) {
	rows, err := s.st.DB.QueryContext(ctx, `SELECT a.id, a.transaction_id, a.idempotency_key, t.updated_at
		FROM charge_attempt a JOIN "transaction" t ON t.id = a.transaction_id
		WHERE t.state = 'UNKNOWN' AND a.status = 'unknown'`)
	if err != nil {
		return
	}
	type job struct{ attemptID, txID, key, updated string }
	var jobs []job
	for rows.Next() {
		var j job
		if rows.Scan(&j.attemptID, &j.txID, &j.key, &j.updated) == nil {
			jobs = append(jobs, j)
		}
	}
	rows.Close()
	for _, j := range jobs {
		t, err := s.loadTx(ctx, j.txID)
		if err != nil {
			continue
		}
		charge, found, err := s.proc.Lookup(ctx, j.key)
		if err != nil {
			continue
		}
		switch {
		case found && charge.Status == processor.Succeeded:
			var points int64
			if ranked, _, err := s.rank(ctx, t.UserID, t.AmountCents, t.Category, t.MerchantBrand); err == nil {
				for _, rk := range ranked {
					if rk.CardID == t.CardID {
						points = rk.ExpectedValueCents
					}
				}
			}
			s.recordSuccess(ctx, t, j.attemptID, charge, points)
			s.log.Info("reconciled UNKNOWN to SUCCEEDED", "tx", t.ID)
		case found:
			s.st.DB.ExecContext(ctx, `UPDATE charge_attempt SET status = 'declined', charge_id = ? WHERE id = ?`, charge.ID, j.attemptID)
			s.finish(ctx, t, Failed, "CardDeclined")
		case time.Since(store.ParseTime(j.updated)) > 15*time.Minute:
			s.st.DB.ExecContext(ctx, `UPDATE charge_attempt SET status = 'error' WHERE id = ?`, j.attemptID)
			s.finish(ctx, t, Failed, "ProcessorTimeout")
		}
	}
}

// abandonStale ends checkouts the consumer never finished.
func (s *Server) abandonStale(ctx context.Context) {
	cutoff := time.Now().UTC().Add(-30 * time.Minute).Format(time.RFC3339Nano)
	rows, err := s.st.DB.QueryContext(ctx, `SELECT id FROM "transaction" WHERE state IN ('INITIATED','AUTHENTICATED','CARD_SELECTED') AND updated_at < ?`, cutoff)
	if err != nil {
		return
	}
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	for _, id := range ids {
		if t, err := s.loadTx(ctx, id); err == nil {
			s.finish(ctx, t, Abandoned, "CheckoutExpired")
		}
	}
}

// sendReceipts delivers receipt emails (REQ-13). Without an email provider
// configured, the receipt is written to the server log.
func (s *Server) sendReceipts(ctx context.Context) {
	rows, err := s.st.DB.QueryContext(ctx, `SELECT n.id, n.email, t.id, m.name, t.amount_cents, COALESCE(c.last4,'')
		FROM notification n JOIN "transaction" t ON t.id = n.transaction_id JOIN merchant m ON m.id = t.merchant_id
		LEFT JOIN user_card c ON c.id = t.card_id WHERE n.status = 'pending' AND n.type = 'receipt' LIMIT 20`)
	if err != nil {
		return
	}
	type job struct {
		id, email, txID, merchant, last4 string
		amount                           int64
	}
	var jobs []job
	for rows.Next() {
		var j job
		if rows.Scan(&j.id, &j.email, &j.txID, &j.merchant, &j.amount, &j.last4) == nil {
			jobs = append(jobs, j)
		}
	}
	rows.Close()
	for _, j := range jobs {
		s.log.Info("receipt email", "to", j.email, "merchant", j.merchant, "amount", fmt.Sprintf("$%.2f", float64(j.amount)/100), "card", "•••• "+j.last4, "tx", j.txID)
		s.st.DB.ExecContext(ctx, `UPDATE notification SET status = 'sent', sent_at = ? WHERE id = ?`, store.Now(), j.id)
	}
}

// SeedMerchant registers a merchant and its checkout button if they do not exist.
func (s *Server) SeedMerchant(ctx context.Context, id, name, brand, webhookURL, webhookSecret, apiKey, buttonID, domain string) error {
	if _, err := s.st.DB.ExecContext(ctx, `INSERT INTO merchant (id, name, brand, webhook_url, webhook_secret, api_key_hash) VALUES (?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET name = excluded.name, brand = excluded.brand, webhook_url = excluded.webhook_url,
		webhook_secret = excluded.webhook_secret, api_key_hash = excluded.api_key_hash`,
		id, name, brand, webhookURL, webhookSecret, store.HashToken(apiKey)); err != nil {
		return err
	}
	_, err := s.st.DB.ExecContext(ctx, `INSERT INTO checkout_button (button_id, merchant_id, allowed_domain, display_config) VALUES (?,?,?,?)
		ON CONFLICT(button_id) DO UPDATE SET allowed_domain = excluded.allowed_domain`, buttonID, id, domain, `{"theme":"dark","label":"Pay with CardStack"}`)
	return err
}
