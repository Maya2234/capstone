# CardStack — Technical Specification Document

**Team:** Luke Brogee, Maya Tomarchio  
**Faculty Advisor:** Dr. Aurisano  
**Version:** 0.1 (draft) · **Date:** 10/28/2026  
**Traces to:** [Requirements Document](Requirements_Document.md) v0.1

## 1. Version and Change Log

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| 0.1 | 10/28/2026 | Initial draft, traced to Requirements Document v0.1. Consolidates D0, D1, D2, and the D3 plan. | Maya Tomarchio |
| 1.0 | 10/29/2026 | Revisions from advisor review (Section 7); retrace to Requirements Document v1.0. | Luke Brogee |


**Design changes since the Week 7 (D1) review**

| Area | Before (Week 7 review) | Now | Why |
| --- | --- | --- | --- |
| Frontend framework | React Vite (D1) | React Native for both apps (D2) | One codebase for the mobile and web apps (D2 rationale 5). |
| Hosting | Google Cloud and Firebase (D1) | Microsoft Azure (D2) | GitHub-integrated deployment and autoscaling (D2 rationale 8 and 10); confirm per Q-04. |
| Payment processor | Unnamed processor (D1) | Stripe, through a Plaid processor token | Plaid hands Stripe a chargeable token, so no PAN reaches CardStack (peer review PR-1). |
| Money format | Float64 amount (D1) | Integer cents | Avoids rounding errors on money (D2 rationale 7). |
| Card in charge request | Caller sends cardId (D1) | Server calls selection internally | Selection returns a ranked list, so fallback happens on the server (D2 interface revisions). |
| Error responses | HTTP 500 for all errors (D1) | 400, 401, 409, 502 plus an error code | Lets clients react to each error type (D2 interface revisions). |


## 2. Architecture Summary

CardStack uses the client-server and layered architecture chosen in D0 (decision D-04); see the D0 block diagram ([Design_Diagrams/D0BlockDiagram.png](Design_Diagrams/D0BlockDiagram.png)) and the D2 checkout flow with error paths (D2, Figure 1).

Major components. The presentation layer holds the Checkout Button, the Checkout Interface (login popup and checkout pages), the Mobile app (iOS/Android), and the Web app. The service layer holds Authentication & User Account, the Transaction & Card Selection Service (Automatic Card Selection and Card Processing), Financial Institution Setup, Transaction history, the Merchant webhook sender, and Receipt forwarding with Notifications. The data layer is the Card/Payment Information Store. External systems are Google sign-in, Plaid, the payment processor (Stripe), and the merchant's site.

Deployment model. The backend is one Go API server deployed as a container on Microsoft Azure App Service, with background workers (merchant webhook retries, receipt sending, reconciliation job) running in the same deployment. The Card/Payment Information Store is a managed Supabase PostgreSQL database. The Web app is a React Native web build on Azure Static Web Apps; the Mobile app is a React Native build for iOS and Android. Keys for Plaid, Stripe, and webhook signing are kept in a secret manager, never in the repository.

Data flow. (1) The merchant page loads the Checkout Button, which checks its button ID and origin. (2) The consumer clicks it; the Checkout Interface opens and the consumer signs in with Google. (3) The Checkout Interface asks the Transaction & Card Selection Service for a ranked card list, which reads linked cards and reward rules from the store. (4) The consumer confirms; Card Processing charges the top card through Stripe with the transactionId as the idempotency key and moves the transaction through its states. (5) The result returns to the Checkout Interface, which routes the consumer back to the merchant, while the Merchant webhook sender posts a signed result to the merchant. (6) On SUCCEEDED, a queue message triggers the receipt email and the transaction appears in Transaction history in the apps. Cards are linked separately: the apps open Plaid Link, and Plaid calls /connect-bank-account with the link result.

## 3. Interfaces and Data Formats

Component boundaries use the interface IDs from D0 and D2 (I1–I11). All APIs are versioned under /server/v1, use JSON over HTTPS, send money as integer cents, and identify users and transactions by UUID.

**Component boundaries**

| ID | Boundary | Inputs | Outputs | Format and protocol | Error behavior |
| --- | --- | --- | --- | --- | --- |
| I1 | Merchant page → Checkout Button → Checkout Interface | Button ID, page origin, orderId, cart total (cents), category | Button config, or ButtonNotAllowed | JSON over HTTPS (GET /server/v1/button/{id}) | 403 ButtonNotAllowed; no button is shown |
| I2 | Checkout Interface ↔ Authentication & User Account | Google ID token | Session token, userId, expiry | JSON over HTTPS | 401 AuthInvalidToken or AuthExpired; consumer signs in again, cart kept |
| I3 | Checkout Interface → Transaction & Card Selection Service | userId, transactionId, amountCents, category, merchantId | Ranked list of {cardId, last4, expectedValueCents} | JSON over HTTPS | 404 E-SEL-NO-CARD; consumer is offered Add a card |
| I4 | Card Selection / Card Processing ↔ Card/Payment Information Store | Queries for user_card and reward_rule; writes to transaction and selection_log | Rows | SQL over TLS (PostgreSQL) | 503 StoreUnavailable; transaction ends FAILED |
| I5 | Card Processing → Payment processor (Stripe) | Processor token, amountCents, currency, idempotency key = transactionId | Charge result: succeeded, declined, or error | Stripe REST API, HTTPS | Declined → next ranked card with consent (REQ-08); timeout after 10 s → UNKNOWN (REQ-10) |
| I6 | Merchant webhook sender → Merchant | {orderId, transactionId, state, amountCents, timestamp} | 2xx acknowledgment | JSON over HTTPS POST to merchant_url; HMAC-SHA256 signature header | Non-2xx or timeout → exponential backoff, 5 attempts, then flag merchant |
| I7 | Mobile app / Web app ↔ Authentication & User Account | Google ID token; logout request | Session token; 204 on logout | JSON over HTTPS | 401 AuthInvalidToken or AuthExpired |
| I8 | Mobile app / Web app → card management | List, remove, set-preferred requests; Plaid Link launch | Card list {cardId, last4, network, preferred} | JSON over HTTPS | 400 bad input; AddInstitutionError on failed link |
| I9 | Plaid → Financial Institution Setup | Link result: userId, institutionId, accountId, success; Plaid verification header | Redirect URL | JSON over HTTPS (POST /server/v1/connect-bank-account) | 400 invalid signature: rejected, logged, nothing stored (EC-05) |
| I10 | Mobile app / Web app → Transaction history | Session token, cursor, limit (default 20) | Page of transactions and nextCursor | JSON over HTTPS (GET /server/v1/transactions) | 401 AuthExpired |
| I11 | Card Processing → Receipt forwarding and Notifications | Queue message {transactionId, userId, state, email} | Email sent; notification row | Internal queue backed by PostgreSQL | Retried until sent; failure logged |


**Endpoint table**

| Method | Path | Caller | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | /server/v1/button/{id} | Checkout Button | Origin header | {buttonId, merchantId, displayConfig} | 403 ButtonNotAllowed, 404 |
| POST | /server/v1/auth/google | Checkout Interface, apps | {idToken} | {sessionToken, userId, expiresAt} | 401 AuthInvalidToken |
| POST | /server/v1/auth/logout | Apps | Session token (header) | 204 No Content | 401 AuthExpired |
| POST | /server/v1/select-card | Checkout Interface | {userId, transactionId, amountCents, category, merchantId} | {ranked: [{cardId, last4, expectedValueCents}]} | 401, 404 E-SEL-NO-CARD, 503 StoreUnavailable |
| POST | /server/v1/process-card-payment | Checkout Interface | {transactionId, orderId, amountCents, category, merchantId}; Idempotency-Key header | {success, transactionId, state, cardLast4, error} | 400, 401, 409 duplicate (returns first result), 502 CardProcessTransactionError |
| POST | /server/v1/connect-bank-account | Plaid webhook | {userId, institutionId, accountId, success}; Plaid-Verification header | {redirectUrl, success, error} | 400 invalid signature, 502 AddInstitutionError |
| GET | /server/v1/cards | Apps | Session token | {cards: [{cardId, last4, network, preferred}]} | 401 |
| PUT | /server/v1/cards/{id}/preferred | Apps | Session token | {cardId, preferred: true} | 401, 404 |
| DELETE | /server/v1/cards/{id} | Apps | Session token | 204 No Content | 401, 404 |
| GET | /server/v1/transactions?cursor=&limit= | Apps | Session token | {items: [{transactionId, merchant, amountCents, createdAt, cardLast4, pointsEarned, state}], nextCursor} | 401 AuthExpired |


**Message formats**

*Request, POST /server/v1/process-card-payment*

```json
{
  "transactionId": "3f6c2a9e-8b1d-4c7a-9e2f-1a2b3c4d5e6f",
  "orderId": "ORD-10482",
  "amountCents": 8999,
  "category": "Clothing",
  "merchantId": "7d1e0c44-2b6a-4f0e-8c1a-9b8d7e6f5a4b"
}
```

*Response (success)*

```json
{
  "success": true,
  "transactionId": "3f6c2a9e-8b1d-4c7a-9e2f-1a2b3c4d5e6f",
  "state": "SUCCEEDED",
  "cardLast4": "4242",
  "error": null
}
```

*Merchant webhook payload (I6), header X-CardStack-Signature: HMAC-SHA256*

```json
{
  "orderId": "ORD-10482",
  "transactionId": "3f6c2a9e-8b1d-4c7a-9e2f-1a2b3c4d5e6f",
  "state": "SUCCEEDED",
  "amountCents": 8999,
  "timestamp": "2027-02-19T15:04:05Z"
}
```

**Database schema (Card/Payment Information Store)**

| Table | Fields | Requirements |
| --- | --- | --- |
| user | id (UUID, PK), email, google_sub, created_at, status | REQ-02 |
| session | token_hash (PK), user_id (FK), expires_at | REQ-02, NFR-05 |
| institution_link | id (PK), user_id (FK), plaid_item_id, status | REQ-06 |
| user_card | id (PK), user_id (FK), institution_link_id (FK), processor_token (encrypted), last4, network, preferred, active | REQ-04, REQ-05, REQ-12, NFR-03, NFR-04 |
| reward_rule | id (PK), card_product_id, category, rate, reward_type | REQ-04 |
| transaction | id (UUID, PK), user_id (FK), card_id (FK), merchant_id, order_id, amount_cents (integer), category, state, error_code, created_at | REQ-05, REQ-07, REQ-10, REQ-11, NFR-09 |
| checkout_button | button_id (PK, indexed), merchant_id, allowed_domain (indexed) | REQ-01, NFR-02 |
| webhook_delivery | id (PK), transaction_id (FK), attempts, next_retry_at, status | REQ-09 |
| selection_log | transaction_id (FK), chosen_card_id, rule_id, reason | REQ-15 |
| receipt / notification | transaction_id, user_id, email or type, status, sent_at | REQ-13 |


**Error codes**

| Error code | HTTP | Meaning | Client behavior |
| --- | --- | --- | --- |
| ButtonNotAllowed | 403 | Button ID unknown or origin not in allowed_domain | Hide the button |
| AuthInvalidToken / AuthExpired | 401 | Google token invalid, or session expired | Prompt sign-in again; keep the cart |
| E-SEL-NO-CARD | 404 | Consumer has no eligible linked card | Show Add a card (REQ-14) |
| StoreUnavailable | 503 | Database not reachable | Show a retry message; transaction FAILED |
| Duplicate | 409 | Same transactionId already submitted | Return the first result; no new charge |
| CardProcessTransactionError | 502 | Processor declined or failed | Offer next card (REQ-08) or return declined to merchant |
| AddInstitutionError | 502 | Plaid link failed | Show error; consumer can retry |
| Bad input | 400 | Missing or invalid field, or invalid webhook signature | Reject; log; store nothing |


## 4. Technology Stack

| Layer | Choice | Justification (REQ / NFR / CON) |
| --- | --- | --- |
| Mobile and web clients | React Native (one codebase; web build via React Native Web) | REQ-11 and REQ-12 must work the same in both apps; one codebase suits a two-person team under CON-01. |
| Backend API | Go | Lightweight concurrency for NFR-01 under concurrent checkouts; Plaid's Go library supports REQ-06. |
| Database | Supabase (managed PostgreSQL) | Relational model with foreign keys for REQ-04 and REQ-05; encryption at rest for NFR-04; free tier for CON-01. |
| Consumer sign-in | Google Sign-In (OAuth 2.0 ID tokens) | REQ-02 and NFR-05; no passwords stored by CardStack (CON-03). |
| Bank and card linking | Plaid Link and Plaid webhooks | REQ-06; consumers' bank credentials and PANs never reach CardStack (NFR-03, CON-05). |
| Payment processing | Stripe, sandbox mode, charged with a Plaid processor token | REQ-05 idempotent charges; card data stays in Stripe's PCI scope (NFR-03, CON-05); per-transaction fees only (CON-01). |
| Hosting | Microsoft Azure App Service (API) and Azure Static Web Apps (web app) | Autoscaling and monitoring for NFR-08; deploys from GitHub; low starting cost (CON-01). |
| Secrets | Azure Key Vault (secret manager) and environment variables | Keeps Plaid, Stripe, and signing keys out of the repository (NFR-04, CON-03). |
| Background work | Go workers with PostgreSQL-backed queue tables | REQ-09, REQ-10, REQ-13 without paying for a separate queue service (CON-01). |
| Testing | Go testing package, Jest, k6 load testing | Unit and API tests for REQ items; k6 measures NFR-01 and NFR-02. |


## 5. Known Constraints

| ID | Constraint | What it rules out or forces |
| --- | --- | --- |
| CON-01 | Economic: costs come from personal funds | Rules out paid-tier services and live payment accounts during development; forces free tiers and sandbox modes (Plaid, Stripe, Supabase, Azure student credits). |
| CON-02 | Professional: faculty expertise in final stages | Forces a faculty security and design review before M12 (04/09/2027) and an advisor review of these documents. |
| CON-03 | Security: planned, documented, tested, overseen | Forces token-only storage, signed webhooks, TLS, a secret manager, and security tests in the Week 10 plan; rules out storing keys in the repository. |
| CON-04 | Social: no consumer fees | Rules out charging consumers or adding surcharges; processor fees must be absorbed or covered by merchants in a later business model. |
| CON-05 | Compliance: no plain-text PANs | Rules out accepting card numbers in CardStack forms or APIs; forces card entry through Plaid and charging through processor tokens. |


## 6. Traceability Matrix

One row per REQ, NFR, and CON ID in Requirements Document v0.1. Test case IDs are the planned Week 10 test IDs. No rows are ORPHANED: every requirement maps to a named design element.

| Req ID | Description | Design Component (D0/D1/D2) | Status | Test Case |
| --- | --- | --- | --- | --- |
| REQ-01 | Button loads only for registered ID and allowed domain | Checkout Button; checkout_button table; GET /button/{id} (D1, D2) | Designed | TC-01 |
| REQ-02 | Google sign-in from checkout; re-prompt on invalid or expired token | Authentication & User Account (D0); auth state machine, I2 (D2) | Designed | TC-02 |
| REQ-03 | Confirm amount, merchant, selected card before charging | Checkout Interface (D0); Login popup and checkout pages (D2) | Designed | TC-03 |
| REQ-04 | Pick highest effective-value card with tie-break order | Transaction & Card Selection Service (D0); Automatic Card Selection, EC-01, EC-02 (D2) | Designed | TC-04 |
| REQ-05 | Charge by processor token with idempotency key | Card Processing (D1); I5, EC-03 (D2) | Designed | TC-05 |
| REQ-06 | Link cards via Plaid; verify webhook signature | Financial Institution Setup, /connect-bank-account (D1); I9, EC-05 (D2) | Designed | TC-06 |
| REQ-07 | Return payment result to merchant and route back | CardStack Checkout Interface, I6 (D0); D-05 (D0) | Designed | TC-07 |
| REQ-08 | Ask consent before charging next-ranked card | Card Processing ranked fallback (D2); peer review PR-2 | In progress | TC-08 |
| REQ-09 | Signed merchant webhook with 5 retries | Merchant webhook, webhook_delivery, EC-06 (D2) | Designed | TC-09 |
| REQ-10 | UNKNOWN after 10 s timeout; reconcile within 15 min | Transaction Lifecycle (D2, Figure 2); EC-04 (D2) | Designed | TC-10 |
| REQ-11 | Paginated transaction history in both apps | Transaction history, I10 (D2); Mobile app, Web app (D2) | Designed | TC-11 |
| REQ-12 | List, remove, set preferred card | Card management I8 (D2); user_card.preferred (D2) | Designed | TC-12 |
| REQ-13 | Receipt email within 1 minute of SUCCEEDED | Receipt forwarding, I11 (D2) | Planned | TC-13 |
| REQ-14 | Empty state with Add a card | Mobile app and Web app, EC-09 (D2) | Designed | TC-14 |
| REQ-15 | Record selection reason in selection log | selection_log table (D2) | Designed | TC-15 |
| NFR-01 | 95% of checkouts back to merchant within 5 s at 20 concurrent | Pattern justification, Performance and Timing (D0); single ranked-list call (D2) | Designed | TC-16 |
| NFR-02 | Button lookup under 300 ms at p95 | Indexed button_id and allowed_domain (D1) | Designed | TC-17 |
| NFR-03 | No PANs stored, logged, or passed through | Token-only storage (D2); Logging glue component (D2); D-02 (D0) | Designed | TC-18 |
| NFR-04 | TLS 1.2+ in transit, AES-256 at rest | Configuration glue component (D2); Card/Payment Information Store (D0) | Designed | TC-19 |
| NFR-05 | 30-minute session expiry; signed webhooks | Authentication session (D2); I6 HMAC header, I9 (D2) | Designed | TC-20 |
| NFR-06 | Checkout in ≤3 clicks, <30 s, ≥90% success | Login popup and checkout pages (D2); UC-01 flow | Planned | TC-21 |
| NFR-07 | First card linked in <3 min, ≥80% success | Mobile app add-card screen with Plaid Link (D2) | Planned | TC-22 |
| NFR-08 | API availability ≥99% monthly from M9 | Client-server deployment, Scalability (D0); Azure hosting (D2 rationale 10) | Planned | TC-23 |
| NFR-09 | No transaction stuck >15 min in PROCESSING or UNKNOWN | Transaction Lifecycle and reconciliation job (D2) | Designed | TC-24 |
| CON-01 | Costs from personal funds | Build vs Reuse (D1); free-tier stack choices (Section 4) | Designed | TC-25 (inspection) |
| CON-02 | Faculty expertise in final stages | Advisor and faculty reviews (D3 milestones M6, M12) | Planned | TC-26 (review record) |
| CON-03 | Security planned, documented, tested, overseen | Configuration and Logging glue components (D2); D-02 (D0) | Designed | TC-18, TC-19, TC-20 |
| CON-04 | No consumer fees | Pricing excluded from all consumer flows (D2 overview) | Designed | TC-27 (inspection) |
| CON-05 | No plain-text PANs | Card/Payment Information Store token-only design (D2); D-02 (D0) | Designed | TC-18 |


## 7. Advisor Review

| Item | Record |
| --- | --- |
| Date of review | 10/29/2026 (send both drafts to Dr. Aurisano at least three days before the deadline) |
| Attendees | Dr. Aurisano, Luke Brogee, Maya Tomarchio |
| Discussed | With our traceability matrix and features planned moving forward we discussed the plan with Dr. Aurisano. She gave insight mainly on creating a feasible product rather than a finished product. We discussed:  <ul><li>How will we know the category when a user makes a purchase to reroute to a specific card<ul><li>Might need to make mockup data for presentation</li></ul></li></ul><ul><li>What to show on mobile<ul><li>Account Settings</li></ul><ul><li>Linked Cards</li></ul><ul><li>Transactions</li></ul><ul><li>Data like top merchants or top categories</li></ul></li></ul><ul><li>Web App<ul><li>Sign Up</li></ul><ul><li>More account settings</li></ul><ul><li>More analytical data</li></ul></li></ul> |
| Changes produced | As of now no changes needed. |

