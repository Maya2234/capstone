# CardStack — Requirements Document

**Team:** Luke Brogee, Maya Tomarchio  
**Faculty Advisor:** Dr. Aurisano  
**Version:** 0.1 (draft) · **Date:** 10/28/2026

## 1. Version and Change Log

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| 0.1 | 10/28/2026 | Initial draft consolidated from User_Stories.md (Week 4), Constraints_Essay.md (Week 3), D0, D1, D2, and the D3 plan. D2 requirements R-1 to R-6 renumbered as REQ/NFR IDs (mapping in Section 5). | Maya Tomarchio |
| 1.0 | 10/29/2026 | Revisions from advisor review  | Luke Brogee |


## 2. Purpose and Scope

This document defines what CardStack must do and for whom. It is the single source for requirement IDs: the Technical Specification traces to it, and the Week 10 test plan verifies against it. It consolidates the user stories, D0 architecture, D1 data model and API contracts, D2 edge cases and traceability table, and the D3 plan; it adds no new design.

CardStack is a payment method that lets a consumer pay with one checkout button and automatically charges the linked credit card that earns the most rewards for the purchase category.

**In scope**

- Stage one: a checkout button merchants embed on their checkout page, consumer sign-in, automatic card selection, card charging through a payment processor, the payment result returned to the merchant, transaction history, receipts, and mobile and web apps for linking and managing cards.

**Out of scope**

- Stage two (the single CardStack card or virtual debit card for in-person and tap payments) is out of scope for this release and has no requirements here. See the Won't list in Section 7.

## 3. Stakeholders and User Goals

Stakeholders and goals come from the Week 4 stakeholder map and user stories ([User_Stories.md](User_Stories.md)).

| Stakeholder | Category | User goals (Week 4) |
| --- | --- | --- |
| Consumer (online shopper) | Primary | Pay with one click instead of typing card details (US-03); have each purchase charged to the card that earns the most rewards for its category (US-02); see purchases, the card used, and points earned. |
| E-Commerce Merchant / Store Developer | Secondary | Offer a checkout option that is easy, fast, and mainstream (US-01); receive a reliable payment result and order confirmation without disruption to existing webhooks; receive settlement funds consistently. |
| Compliance Auditor & Payment Card Networks | Hidden | Never use the button, but require that card numbers (PANs) are never stored in plain text and that encryption standards are met. |


## 4. Glossary

Each domain term and role name is defined once here and used with this meaning in both documents.

| Term | Definition |
| --- | --- |
| CardStack | The system described in this document, including its backend services and its mobile and web apps. |
| Consumer | A person who pays with CardStack and manages linked cards in the apps. Also called the user. |
| Merchant | A business that embeds the Checkout Button on its e-commerce site and receives the payment result. |
| Store Developer | The merchant's developer who installs and configures the Checkout Button. |
| Compliance Auditor | A party that checks card-data handling against card network rules; never uses the system directly. |
| Checkout Button | The CardStack button embedded on a merchant's checkout page, identified by a button ID and restricted to an allowed domain. |
| Checkout Interface | The login popup and checkout pages that open from the Checkout Button and show the cart, the selected card, and the result. |
| Linked card | A credit card the consumer has connected to CardStack through Plaid and that CardStack may charge. |
| Preferred card | The one linked card the consumer marks as preferred; used first to break ties in card selection. |
| PAN | Primary Account Number: the full credit card number. CardStack never stores or transmits it. |
| Processor token | A token issued for a linked card that lets the payment processor charge the card without CardStack seeing the PAN. |
| Plaid / Plaid Link | The third-party service, and its sign-in widget, that connects a consumer's bank and credit accounts to CardStack. |
| Payment processor | The external service that charges a card using a processor token (Stripe, sandbox mode, in this release). |
| Purchase category | The merchant category of a transaction (for example, Clothing) used to look up reward rates. |
| Reward rule | The reward rate and type (cash back, points, or miles) a card product earns in one purchase category. |
| Effective value | The rewards a card would earn on a transaction, in cents: amount × rate × point value. |
| Transaction | One purchase attempt, identified by a transactionId (UUID), that moves through the transaction states. |
| Transaction state | One of INITIATED, AUTHENTICATED, CARD_SELECTED, PROCESSING, UNKNOWN, SUCCEEDED, FAILED, or ABANDONED (D2, Figure 2). SUCCEEDED, FAILED, and ABANDONED are terminal states. |
| Idempotency key | The transactionId sent with a charge so that a repeated request cannot charge twice. |
| Merchant webhook | The signed message CardStack sends to the merchant's endpoint when a transaction reaches a terminal state. |
| Reconciliation job | The background job that asks the processor for the final result of a transaction left in UNKNOWN. |
| Session | A short-lived sign-in issued after Google sign-in, stored as a token hash. |
| Sandbox | The test environments of Plaid and the payment processor, which use test accounts and move no real money. |
| MoSCoW | Prioritization into Must, Should, Could, and Won't (for this release). |


## 5. Functional Requirements

Each requirement is stated so a teammate can say objectively whether it passes or fails. IDs are stable and never reused; a dropped requirement is marked withdrawn and logged in the change log.

| ID | Requirement | MoSCoW | Source story | Verification |
| --- | --- | --- | --- | --- |
| REQ-01 | The system shall load the Checkout Button only when its button ID is registered and the page origin matches the button's allowed domain; any other request shall return ButtonNotAllowed and show no button. | Must | US-01 | Test |
| REQ-02 | The system shall let a consumer sign in with Google from the Checkout Interface and issue a session; an invalid or expired token shall return AuthInvalidToken or AuthExpired and prompt sign-in again without losing the cart. | Must | US-03; UC-01 step 2a | Test |
| REQ-03 | The system shall show the consumer the purchase amount, the merchant, and the selected card (network and last four digits) before charging, and shall charge only after the consumer clicks Purchase. | Must | UC-01 steps 3–4 | Demonstration |
| REQ-04 | For each transaction, the system shall select the linked card with the highest effective value for the purchase category, excluding expired, frozen, or insufficient-credit cards, and shall break ties by preferred card, then lowest utilization, then oldest card. | Must | US-02 | Test |
| REQ-05 | The system shall charge the selected card through the payment processor using only its processor token, with the transactionId as the idempotency key, so that repeated submissions of one transaction produce exactly one charge. | Must | US-03; UC-01 step 5 | Test |
| REQ-06 | The system shall let a consumer link credit cards and bank accounts through Plaid Link and shall store a link only after verifying the Plaid webhook signature; a link with an invalid signature shall be rejected and nothing stored. | Must | US-02 | Test |
| REQ-07 | The system shall return the payment result (orderId, status approved or declined, transactionId, and a reason when declined) to the merchant checkout and route the consumer back to the merchant site. | Must | UC-01 step 5; UC-01.2 | Test |
| REQ-08 | When a charge is declined and another linked card is available, the system shall show the consumer which card was declined and ask permission before charging the next-ranked card. | Should | UC-01.2 | Test |
| REQ-09 | The system shall send the merchant a signed result payload for every transaction that reaches a terminal state, retrying with exponential backoff for up to 5 attempts and flagging the merchant after the fifth failure. | Should | Stakeholder map (Merchant); US-01 | Test |
| REQ-10 | The system shall mark a transaction UNKNOWN when the processor does not respond within 10 seconds and shall resolve it to SUCCEEDED or FAILED through the reconciliation job within 15 minutes. | Should | UC-01.1; UC-01.2 | Test |
| REQ-11 | The system shall show a consumer, in the mobile and web apps, a paginated transaction history of 20 items per page listing merchant, amount, date, card used (last four), and points earned. | Should | US-02 | Demonstration |
| REQ-12 | The system shall let a consumer list and remove linked cards and mark one card as preferred from the mobile and web apps. | Should | US-02 | Demonstration |
| REQ-13 | The system shall email the consumer a receipt within 1 minute of a transaction reaching SUCCEEDED. | Could | UC-01 (receipt forwarding, D1) | Test |
| REQ-14 | The system shall show a consumer with no linked cards an empty state with an Add a card action that opens Plaid Link. | Could | US-02 | Demonstration |
| REQ-15 | The system shall record, for each card selection, the chosen card, the reward rule applied, and the reason in the selection log. | Could | US-02 | Inspection |


D2 traceability IDs map to this document as follows: R-1 → REQ-01, REQ-03; R-2 → REQ-04; R-3 → REQ-06; R-4 → REQ-11; R-5 → NFR-03, NFR-04; R-6 → NFR-01, NFR-02.

## 6. Non-Functional Requirements

| ID | Category | Requirement | MoSCoW | Source story | Verification |
| --- | --- | --- | --- | --- | --- |
| NFR-01 | Performance | The system shall route the consumer back to the merchant site within 5 seconds of clicking Purchase for at least 95% of transactions, measured in the staging sandbox under 20 concurrent checkouts. | Must | UC-01.1; UC-01.2 | Test (load test) |
| NFR-02 | Performance | The system shall answer the Checkout Button lookup (GET /server/v1/button/{id}) within 300 ms at the 95th percentile. | Should | US-01 | Test |
| NFR-03 | Security | The system shall never store, log, or pass through its servers a full card number (PAN); the data store shall hold only processor tokens and the last four digits. | Must | Stakeholder map (Compliance Auditor) | Inspection (schema and log review) and Test |
| NFR-04 | Security | All traffic between clients, CardStack, and external services shall use HTTPS with TLS 1.2 or higher, and processor tokens shall be encrypted at rest with AES-256. | Must | Stakeholder map (Compliance Auditor); CON-03 | Inspection |
| NFR-05 | Security | Sessions shall expire after 30 minutes of inactivity, and every inbound Plaid webhook and outbound merchant webhook shall carry a signature that is verified before it is processed. | Should | US-03; CON-03 | Test |
| NFR-06 | Usability | A consumer with at least one linked card shall complete checkout from the button click in no more than 3 clicks and under 30 seconds, with a success rate of at least 90% across 5 usability-test participants. | Should | US-01; US-03 | Demonstration (usability test) |
| NFR-07 | Usability | A first-time consumer shall link a first card through Plaid Link in under 3 minutes, with at least 80% of usability-test participants succeeding without help. | Could | US-02 | Demonstration (usability test) |
| NFR-08 | Reliability | The backend API shall be available at least 99% of the time in each month from M9 (02/19/2027) through the final demo, measured by an external uptime monitor. | Should | US-01 | Test (uptime monitoring) |
| NFR-09 | Reliability | No transaction shall remain in PROCESSING or UNKNOWN for more than 15 minutes; every transaction shall reach a terminal state that is recorded in the data store. | Should | UC-01.2 | Test |


## 7. MoSCoW Summary

10 of 24 requirements (42%) are Must. The Must set is the minimum viable checkout: a validated button, sign-in, a confirmed purchase charged once to the best card, linked cards, the result returned to the merchant, a 5-second checkout, and secure card handling.

- **Must:** REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, NFR-01, NFR-03, NFR-04
- **Should:** REQ-08, REQ-09, REQ-10, REQ-11, REQ-12, NFR-02, NFR-05, NFR-06, NFR-08, NFR-09
- **Could:** REQ-13, REQ-14, REQ-15, NFR-07
- **Won't (this release):** the items below are written down so they cannot creep back in.
  - The single CardStack card or virtual debit card, and in-person or tap payments (stage two).
  - Building CardStack's own payment processor or card network connection.
  - Storing, displaying, or accepting full card numbers inside CardStack.
  - Refunds, chargebacks, and disputes inside CardStack (handled by the merchant and the processor).
  - Currencies other than USD, and merchants outside the United States.
  - Recurring or subscription payments.
  - A merchant analytics dashboard.
  - Consumer sign-in methods other than Google.

## 8. Inherited Constraints

Constraints come from the Week 3 constraints essay ([Constraints_Essay.md](Constraints_Essay.md)), plus the compliance constraint from the Week 4 stakeholder map.

| ID | Category | Constraint | Source |
| --- | --- | --- | --- |
| CON-01 | Economic | Third-party API costs (bank connection, payment processing, hosting) must be covered by the team's personal funds, with possible prototype funding from the UC innovation challenge. | Week 3 essay (Economic) |
| CON-02 | Professional | Professional expertise will be sought from appropriate UC faculty, mainly in the final stages of the project. | Week 3 essay (Professional) |
| CON-03 | Security | Because card and bank information is sensitive, security measures must be planned, documented, tested, and overseen by faculty and other application-security experts. | Week 3 essay (Security) |
| CON-04 | Social | The platform must charge consumers no fees, so that it stays accessible and beneficial to the general public. | Week 3 essay (Social) |
| CON-05 | Compliance | Card numbers (PANs) must never be stored in plain text, and encryption standards set by the card networks must be met. | Week 4 stakeholder map (Hidden stakeholder) |


## 9. Assumptions and Open Questions

| ID | Type | Statement | Owner | Resolve by |
| --- | --- | --- | --- | --- |
| A-01 | Assumption | A Plaid processor token for a linked credit card can be charged by the payment processor (Plaid → Stripe), so CardStack never handles a PAN. | Maya | 11/10/2026 |
| A-02 | Assumption | Reward rules for common card products can be researched by the team and entered manually; no live reward-rate feed is required for this release. | Maya | 12/04/2026 |
| A-03 | Assumption | A team-built test merchant site is enough to demonstrate merchant integration; no real merchant is required. | Luke | 11/20/2026 |
| Q-01 | Open question | What point value (in cents) should each miles or points program use so it can be compared with cash back? | Maya | 01/22/2027 |
| Q-02 | Open question | Does Plaid return available credit for every linked credit account, so cards without enough credit can be excluded (REQ-04)? | Maya | 02/03/2027 |
| Q-03 | Open question | Confirm one userId format (UUID) across all contracts, as D2 requires. | Luke | 10/31/2026 |
| Q-04 | Open question | Confirm the hosting provider: D1 names Google Cloud and Firebase, D2 names Microsoft Azure (peer review PR-3). | Luke | 10/31/2026 |
| Q-05 | Open question | Which transactional email service sends receipts (REQ-13)? | Maya | 02/15/2027 |

