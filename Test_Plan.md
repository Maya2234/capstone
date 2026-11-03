# CardStack — Test Plan

**Team:** Luke Brogee, Maya Tomarchio  
**Faculty Advisor:** Dr. Aurisano  
**Test Lead:** Luke Brogee  
**Version:** 0.1 (draft) · **Date:** MM/DD/2026  
**Traces to:** Requirements_Document.md v1.0, Technical_Specification.md v1.0

## 1. Scope

<!-- List every item by requirement ID AND component. Give a reason for every exclusion. -->

### In scope this cycle

| Requirement ID | Component | Notes |
| --- | --- | --- |
| REQ-01 | Checkout Button | |
| REQ-02 | Authentication & User Account | |
| REQ-03 | Mobile app & Web app (Checkout Interface) | |
| REQ-04 | Transaction & Card Selection Service | |
| REQ-05 | Card Processing | |
| REQ-06 | Financial Institution Setup | |
| REQ-07 | Merchant webhook / Checkout Interface | |
| NFR-01 | End-to-end checkout | |
| NFR-03 | Card/Payment Information Store | |
| NFR-04 | Card/Payment Information Store / Configuration | |
| | | <!-- add the Should and Could items you will test --> |

### Out of scope

| Item | Type | Reason |
| --- | --- | --- |
| Stage two: CardStack card, virtual debit card, in-person and tap payments | Won't | |
| Our own payment processor or card network connection | Won't | |
| Storing, displaying, or accepting full card numbers | Won't | |
| Refunds, chargebacks, and disputes | Won't | |
| Non-USD currencies and non-US merchants | Won't | |
| Recurring or subscription payments | Won't | |
| Merchant analytics dashboard | Won't | |
| Sign-in methods other than Google | Won't | |
| | Could (deferred) | |
| | Known limitation | |
| Google Sign-In, Plaid Link, Stripe, Supabase, Azure | Third-party | |

## 2. Verification and Validation Strategy

<!-- About half a page. Which requirements are verified by the team against the spec, and which are validated against stakeholder needs by users or the advisor. -->

**Verification (team, against the spec):**

**Validation (users and advisor, against stakeholder needs):**

CardStack has no hardware, sensor, or machine learning component, so trial variables and tolerances do not apply.

| Layer | Approx. count | Coverage focus |
| --- | --- | --- |
| Unit | | |
| Integration | | |
| System | | |
| Acceptance | | |

## 3. Success Criteria

<!-- One row per NFR and per numeric condition in a functional requirement. Every row needs a requirement ID. -->

| Metric | Target threshold | How it is measured | Requirement ID |
| --- | --- | --- | --- |
| | | | NFR-01 |
| | | | NFR-02 |
| | | | NFR-03 |
| | | | NFR-04 |
| | | | NFR-05 |
| | | | NFR-06 |
| | | | NFR-07 |
| | | | NFR-08 |
| | | | NFR-09 |
| | | | REQ-09 |
| | | | REQ-10 |
| | | | REQ-11 |
| | | | REQ-13 |

## 4. Test Cases

<!-- At least 3 cases per major requirement (every Must is major). Each group needs at least one edge case or failure condition; draw these from D2 EC-01 to EC-09. Status is Pass, Fail, Blocked, or Not Run. IDs must match the Test Case column of the traceability matrix in Technical_Specification.md Section 6. -->

### 4.1 REQ-01 — Checkout Button loads only for registered ID and allowed domain (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-01.1 | | 1. | | Not Run |
| TC-01.2 | | 1. | | Not Run |
| TC-01.3 | | 1. | | Not Run |

### 4.2 REQ-02 — Google sign-in; re-prompt on invalid or expired token (Owner: Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-02.1 | | 1. | | Not Run |
| TC-02.2 | | 1. | | Not Run |
| TC-02.3 | | 1. | | Not Run |

### 4.3 REQ-03 — Confirm amount, merchant, and selected card before charging (Owner: Luke / Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-03.1 | | 1. | | Not Run |
| TC-03.2 | | 1. | | Not Run |
| TC-03.3 | | 1. | | Not Run |

### 4.4 REQ-04 — Highest effective-value card with tie-break order (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-04.1 | | 1. | | Not Run |
| TC-04.2 | | 1. | | Not Run |
| TC-04.3 | | 1. | | Not Run |

### 4.5 REQ-05 — Charge by processor token with idempotency key (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-05.1 | | 1. | | Not Run |
| TC-05.2 | | 1. | | Not Run |
| TC-05.3 | | 1. | | Not Run |

### 4.6 REQ-06 — Link cards via Plaid; verify webhook signature (Owner: Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-06.1 | | 1. | | Not Run |
| TC-06.2 | | 1. | | Not Run |
| TC-06.3 | | 1. | | Not Run |

### 4.7 REQ-07 — Return payment result to merchant and route back (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-07.1 | | 1. | | Not Run |
| TC-07.2 | | 1. | | Not Run |
| TC-07.3 | | 1. | | Not Run |

### 4.8 NFR-01 — 95% of checkouts back to merchant within 5 s at 20 concurrent (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-16.1 | | 1. | | Not Run |
| TC-16.2 | | 1. | | Not Run |
| TC-16.3 | | 1. | | Not Run |

### 4.9 NFR-03 — No PANs stored, logged, or passed through (Owner: Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-18.1 | | 1. | | Not Run |
| TC-18.2 | | 1. | | Not Run |
| TC-18.3 | | 1. | | Not Run |

### 4.10 NFR-04 — TLS 1.2+ in transit, AES-256 at rest (Owner: Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-19.1 | | 1. | | Not Run |
| TC-19.2 | | 1. | | Not Run |
| TC-19.3 | | 1. | | Not Run |

<!-- Add groups for any Should or Could requirements you test this cycle, using the TC number from the traceability matrix (e.g. REQ-08 → TC-08.x, NFR-09 → TC-24.x). -->

## 5. Test Environment

<!-- Pin versions so another team could reproduce the setup. Name sandbox accounts, never paste keys. -->

| Item | Development | Staging | Pilot |
| --- | --- | --- | --- |
| Hosting | | | |
| Operating systems | | | |
| Browsers and versions | | | |
| Mobile devices / emulators | | | |
| Backend runtime (Go version) | | | |
| Test tools (Go test, Jest, k6 versions) | | | |
| Database (Supabase project) | | | |
| Stripe mode | | | |
| Plaid environment | | | |
| Seeded test data | | | |
| Network conditions | | | |

## 6. Pass and Fail Criteria

<!-- State both the pass condition and what counts as a failure, tied to the Part 3 metrics. -->

### Per test case

**Pass:**

**Fail:**

**Blocked:**

### Plan as a whole

**Pass:**

**Fail:**

## 7. Test Schedule

<!-- Unit and integration during sprints; system and acceptance before reviews and demos. Order by risk: core checkout and data integrity first. Milestones from D3 (Week 8). -->

| Milestone | Test activity | Owner | Evidence |
| --- | --- | --- | --- |
| | | | |
| M6 | | | |
| M9 (02/19/2027) | | | |
| M12 (04/09/2027) | | | |

## 8. Definition of Done

### Feature level

- [ ] Tests:
- [ ] Review:
- [ ] Documentation:
- [ ] Open defects:
- [ ] Sign-off:

### Project level

- [ ] Tests:
- [ ] Review:
- [ ] Documentation:
- [ ] Open defects:
- [ ] Sign-off:
