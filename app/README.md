# CardStack prototype

A working model of CardStack built from the [Requirements Document](../Requirements_Document.md) and [Technical Specification](../Technical_Specification.md).

| Folder | What it is |
| --- | --- |
| `server/` | Go API (`/server/v1`), background workers, Checkout Button script, Checkout Interface and sandbox Plaid Link pages |
| `consumer/` | React Native (Expo Router) app for web, iOS and Android: link cards, financial overview, best-card finder, history, rewards library |
| `merchant-demo/` | "Threadline Apparel", a sample store that integrates the Checkout Button the way a real merchant would |
| `data/card_products.json` | Reward rules for 43 US credit cards from 11 issuers, with issuer source links |

## Run it

You need Go 1.27+ and Node 20+. In three terminals:

```bash
cd app/server && go run ./cmd/cardstack
```

```bash
cd app/merchant-demo && go run .
```

```bash
cd app/consumer && npm install && npx expo start --web --port 8081
```

Then:

1. Open http://localhost:8081, sign in with any email, and choose **Add a card**. Pick a bank in the sandbox Link page.
2. Open http://localhost:4000, add something to the cart, and click **Pay with CardStack**. Sign in with the same email.
3. CardStack ranks your cards, you confirm, and the store marks the order paid when its signed webhook arrives.

Run the tests with `cd app/server && go test ./...`.

### Sandbox test cards

Link **CardStack Test Bank** to try the error paths:

| Card | Behavior | Requirement |
| --- | --- | --- |
| •••• 0002 | Always declined; checkout offers your next-best card and asks first | REQ-08 |
| •••• 0010 | Processor never answers; the transaction goes to UNKNOWN for 10 s and reconciliation resolves it | REQ-10 |

## What is real and what is mocked

| Piece | Status |
| --- | --- |
| Card selection, reward caps, tie-breaks, selection log | Real (REQ-04, REQ-15) |
| Transaction state machine, idempotent charging, decline fallback with consent | Real (REQ-05, REQ-08) |
| Merchant webhooks with HMAC signatures, 5 retries with backoff, merchant flagging | Real (REQ-09) |
| UNKNOWN reconciliation, abandoned-checkout sweep | Real (REQ-10, NFR-09) |
| Button origin check, merchant API keys, server-side checkout sessions | Real (REQ-01) |
| Sessions expiring after 30 minutes of inactivity; AES-256-GCM encrypted processor tokens; no PANs anywhere | Real (NFR-03, NFR-04, NFR-05) |
| **Plaid** | Mock with Plaid's shape (link token, public token exchange, processor tokens, signed webhook). Replace `internal/plaid` with calls to Plaid sandbox. |
| **Stripe** | Mock that behaves like Stripe test mode. Replace `internal/processor` with a Stripe client using the Plaid processor token. |
| **Google sign-in** | Server verifies real Google ID tokens when `GOOGLE_CLIENT_ID` is set. In development, `dev:<email>` stands in. The consumer app only has the development sign-in so far. |
| **Database** | SQLite locally (no Docker needed). Same tables as the spec, so it can move to Supabase PostgreSQL. |
| **Receipts** | Queued and written to the server log; no email provider yet (REQ-13). |

## Differences from the Technical Specification

Log these in the specification's version log if you keep them.

- **Checkout sessions.** The merchant's server now creates the transaction with `POST /server/v1/merchant/checkout-sessions` using a secret API key, so a shopper cannot change the amount in the browser. `select-card` and `process-card-payment` read the amount and category from that stored transaction instead of the request body.
- **Fallback idempotency keys.** The first charge uses the `transactionId` as the idempotency key. A consented fallback card uses `transactionId:2`, `:3` and so on, because a processor would return the cached decline for a reused key.
- **Extra endpoints:** `/me`, `PATCH /cards/{id}` (chosen bonus categories, rotating categories, freeze), `/card-products`, `/recommend`, `/accounts`, `/insights`, `/external-transactions`, `/checkout/{id}`, `/checkout/{id}/cancel`, `/merchant/transactions/{id}`, `/config`.
- **ABANDONED** is set when the consumer cancels or a checkout sits unfinished for 30 minutes.

## Card reward data

`data/card_products.json` lists each card's category rates, caps, annual fee, a conservative point value, the issuer page and a confidence label (`high`, `medium`, `low`). Rates change often and were compiled as of the `asOf` date, so verify any number against the issuer page before relying on it. Rates that only apply on an issuer's travel site (`portal:`) are ignored at checkout. Cards with rotating or chosen categories use the categories the consumer sets in the app.

Effective value = amount × rate × point value (Requirements glossary). Citi Custom Cash assumes the purchase category becomes the card's top category for the cycle.

## Next steps

1. Create Plaid and Stripe sandbox accounts and swap the two mocks for real adapters.
2. Add Google Sign-In to the consumer app and set `GOOGLE_CLIENT_ID`.
3. Port `schema.sql` to PostgreSQL for Supabase and deploy to Azure (spec §2).
4. Add k6 load tests for NFR-01 and NFR-02.
