// Package processor is the payment processor adapter (I5).
//
// Mock behaves like Stripe in test mode: charges are idempotent on the key,
// a card with mask 0002 is always declined, and a card with mask 0010 never
// answers within the timeout so the transaction goes to UNKNOWN (REQ-10).
// A Stripe adapter using the Plaid processor token can replace it.
package processor

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"sync"
)

type Status string

const (
	Succeeded Status = "succeeded"
	Declined  Status = "declined"
)

type Charge struct {
	ID          string `json:"id"`
	Status      Status `json:"status"`
	AmountCents int64  `json:"amountCents"`
	DeclineCode string `json:"declineCode,omitempty"`
}

var ErrTimeout = errors.New("processor did not respond in time")

type Processor interface {
	Charge(ctx context.Context, processorToken string, amountCents int64, currency, idempotencyKey string) (Charge, error)
	// Lookup returns the final result of a charge by idempotency key (reconciliation).
	Lookup(ctx context.Context, idempotencyKey string) (Charge, bool, error)
}

type Mock struct {
	mu      sync.Mutex
	charges map[string]Charge
	// Calls counts real (non-idempotent) charges, so tests can prove one charge per transaction.
	Calls int
}

func NewMock() *Mock { return &Mock{charges: map[string]Charge{}} }

func (m *Mock) Charge(ctx context.Context, tok string, amountCents int64, currency, key string) (Charge, error) {
	m.mu.Lock()
	if c, ok := m.charges[key]; ok {
		m.mu.Unlock()
		return c, nil
	}
	m.mu.Unlock()

	switch {
	case strings.Contains(tok, "-0010-"):
		// The charge goes through on the processor's side, but the answer never arrives.
		m.record(key, Charge{ID: chargeID(), Status: Succeeded, AmountCents: amountCents})
		<-ctx.Done()
		return Charge{}, ErrTimeout
	case strings.Contains(tok, "-0002-"):
		return m.record(key, Charge{ID: chargeID(), Status: Declined, AmountCents: amountCents, DeclineCode: "card_declined"}), nil
	}
	return m.record(key, Charge{ID: chargeID(), Status: Succeeded, AmountCents: amountCents}), nil
}

func (m *Mock) record(key string, c Charge) Charge {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Calls++
	m.charges[key] = c
	return c
}

func (m *Mock) Lookup(ctx context.Context, key string) (Charge, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.charges[key]
	return c, ok, nil
}

func chargeID() string {
	b := make([]byte, 10)
	rand.Read(b)
	return "ch_sandbox_" + hex.EncodeToString(b)
}
