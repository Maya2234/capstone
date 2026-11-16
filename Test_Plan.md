# CardStack — Test Plan

**Team:** Luke Brogee, Maya Tomarchio  
**Faculty Advisor:** Dr. Aurisano  
**Test Lead:** Luke Brogee  
**Version:** 0.1 (draft) · **Date:** 11/4/2026  
**Traces to:** Requirements_Document.md v1.0, Technical_Specification.md v1.0

## 1. Scope

### In scope this cycle

| Requirement ID | Component | Notes |
| --- | --- | --- |
| REQ-01 | Checkout Button | E-commerce merchant checkout button plugin and iframe/modal component.|
| REQ-02 | Authentication & User Account |User identity and session management restricted strictly to Google Sign-In. |
| REQ-03 | Mobile app & Web app (Checkout Interface) |Multi-platform user checkout interface spanning Web (React/Vite) and Mobile (React Native). |
| REQ-04 | Transaction & Card Selection Service |Core recommendation algorithm selecting the highest effective-value card with deterministic tie-breaks. |
| REQ-05 | Card Processing |Secure processor token charging with idempotency key enforcement. |
| REQ-06 | Financial Institution Setup | Bank account linking via Plaid and cryptographic webhook signature verification.|
| REQ-07 | Merchant webhook / Checkout Interface |Payment result transmission back to the merchant and secure routing/redirection. |
| NFR-01 | End-to-end checkout |Performance benchmark: 95% of checkouts complete within 5 seconds at 20 concurrent users. |
| NFR-03 | Card/Payment Information Store |Strict PCI compliance: No PANs stored, logged, or passed through internal systems. |
| NFR-04 | Card/Payment Information Store / Configuration |Data security in transit and at rest: TLS 1.2+ mandatory, AES-256 for all datastores. |


### Out of scope

| Item | Type | Reason |
| --- | --- | --- |
| Stage two: CardStack card, virtual debit card, in-person and tap payments | Won't |Restricts scope to the core e-commerce checkout button plugin and recommendation system; physical card manufacturing and NFC tap infrastructure are reserved for future major company milestones. |
| Our own payment processor or card network connection | Won't |Avoids massive regulatory overhead (PCI-DSS Level 1 direct acquirer requirements); instead, leverages established tokenized processors (Stripe). |
| Storing, displaying, or accepting full card numbers | Won't |Enforces rigorous security compliance (NFR-03); raw Primary Account Numbers never touch CardStack servers or logs. |
| Refunds, chargebacks, and disputes | Won't |Defers dispute management and merchant ledger operations entirely to the underlying payment processor and merchant dashboard integrations. |
| Non-USD currencies and non-US merchants | Won't |Focuses initial market fit strictly on domestic US e-commerce transactions and USD-denominated accounts. |
| Recurring or subscription payments | Won't |Focuses exclusively on single-instance, dynamic e-commerce checkouts rather than billing recurrence engines. |
| Merchant analytics dashboard | Won't |Eliminates scope creep for reporting UIs; relies on underlying gateway logs and basic transactional status returns. |
| Sign-in methods other than Google | Won't |Standardizes identity provider integration to streamline authentication flows and reduce security surface area. |
|Additional payment rails or alternative wallet logins | Could (deferred) |Maintained as a potential post-launch enhancement depending on user acquisition metrics and demand. |
| Google Sign-In, Plaid Link, Stripe, Supabase, Azure | Third-party |Core technology stack components utilized for identity management, bank account verification (Plaid), payment processing (Stripe), database/backend state (Supabase), and cloud hosting infrastructure (Azure). |

## 2. Verification and Validation Strategy

**Verification (team, against the spec):**
Conducted internally by the development team to ensure that every implemented component precisely adheres to functional specifications and engineering constraints. This tier relies on automated unit tests (go test, Jest), integration test suites, database schema audits, security scans, and performance load tests (k6). Key verification targets include enforcing zero-PAN data handling (NFR-03), validating cryptographic webhook signatures for Plaid (REQ-06), verifying idempotency key protection on Stripe charges (REQ-05), and proving that 95% of checkouts complete within 5 seconds under a concurrent load of 20 users (NFR-01).

**Validation (users and advisor, against stakeholder needs):**
Conducted externally through user acceptance testing (UAT) with beta users, pilot merchant partners, and faculty advisors (CS 5002). While verification proves the system is built right, validation ensures we built the right system. This focuses on user experience, end-to-end checkout friction, intuitive wallet management, and ensuring the recommendation engine's highest effective-value card selection (REQ-04) delivers genuine financial utility and satisfaction to the end user.

CardStack has no hardware, sensor, or machine learning component, so trial variables and tolerances do not apply.

| Layer | Approx. count | Coverage focus |
| --- | --- | --- |
| Unit | ~130 tests|Core reward calculation engine, card valuation normalization, tie-break logic (REQ-04), individual Go backend handlers, and React/React Native component rendering. |
| Integration | ~45 tests|Third-party API communication boundaries, including Stripe token charging (REQ-05), Plaid Link webhook signature verification (REQ-06), Supabase operations, and Azure SQL database queries. |
| System |~15 test suites | End-to-end checkout flows, merchant redirection routing (REQ-07), Google OAuth authentication sessions (REQ-02), idempotency replay handling, and k6 performance concurrency benchmarks (NFR-01).|
| Acceptance |~8 user scenarios |Pilot merchant UAT, cross-platform mobile/web UI usability (REQ-03), security compliance checks (TLS/AES-256 validation under NFR-04, zero-PAN storage audits under NFR-03). |

## 3. Success Criteria

| Metric | Target Threshold | How it is Measured | Requirement ID |
| :--- | :--- | :--- | :--- |
| **End-to-End Checkout Latency (p95)** | Less than or equal to 5.0 seconds at 20 concurrent users | Automated load testing using `k6` measuring total round-trip time from checkout button click to merchant redirection. | **NFR-01** |
| **System Uptime / Availability** | Greater than or equal to 99.5 percent uptime during pilot testing | Continuous uptime monitoring via Azure App Service health checks and synthetic ping probes. | **NFR-02** |
| **PAN Storage Footprint** | 0 instances (Zero raw card numbers stored or logged) | Automated database schema audits and log-scraping regex scans for 13 to 19 digit PAN patterns. | **NFR-03** |
| **Transport and Rest Encryption** | TLS 1.2+ mandatory in transit; AES-256 enabled at rest | SSL Labs security scanner for TLS configurations and Azure Portal compliance checks for Transparent Data Encryption (TDE). | **NFR-04** |
| **API Error Rate under Nominal Load** | Less than 1 percent error rate for valid requests | Automated integration test suites and server-side HTTP status code telemetry. | **NFR-05** |
| **Idempotency Duplicate Prevention** | 100 percent prevention of double-charging on retries | Automated API tests firing duplicate requests with identical `Idempotency-Key` headers. | **NFR-06** |
| **Webhook Signature Verification Success** | 100 percent valid signatures accepted; 100 percent invalid or forged rejected | Security test suites injecting valid and forged `Plaid-Verification` headers. | **NFR-07** |
| **Database Connection Pool Stability** | Zero connection exhaustion or leaks under max concurrency | Azure SQL metrics tracking active database sessions and connection wait times during `k6` load runs. | **NFR-08** |
| **Cross-Platform UI Rendering Consistency** | Functional parity across Web (React) and Mobile (React Native) | Manual and automated UI testing across Chrome, Safari, iOS Simulator, and Android Emulator. | **NFR-09** |
| **Google OAuth Authentication Speed** | Less than or equal to 2.0 seconds for token exchange and session creation | Client-side performance tracing from Google sign-in trigger to authenticated dashboard load. | **REQ-09** |
| **Plaid Link Token Exchange Success Rate** | Greater than or equal to 98 percent successful public-to-access token conversion | End-to-end integration logs tracking Plaid API response codes during account linking. | **REQ-10** |
| **Recommendation Engine Calculation Time** | Less than or equal to 200 milliseconds for optimal card selection | Backend execution timers measuring elapsed time from transaction payload receipt to card selection output. | **REQ-11** |
| **Merchant Callback Routing Accuracy** | 100 percent accurate return routing with signed status parameters | Automated end-to-end test assertions verifying HTTP 302 redirect destinations and query parameters. | **REQ-13** |

## 4. Test Cases

### 4.1 REQ-01 — Checkout Button loads only for registered ID and allowed domain (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-01.1 |REQ-01: Ecommerce page has correct registered ID and allowed domain | 1. | On ecommerce page load the CardStack checkout button will appear for the user to checkout with | Not Run |
| TC-01.2 |REQ-01: Ecommerce page has incorrect registered ID | 1. | On ecommerce page load the CardStach checkout button will silently fail and not appear as an option to checkout. Send alert to ecommerce user of registeredID error | Not Run |
| TC-01.3 |REQ-01: Ecommerce page has incorrect allowed domain | 1. | On ecommerce page load the CardStach checkout button will silently fail and not appear as an option to checkout. Send alert to ecommerce user of domain error | Not Run |

### 4.2 REQ-02 — Google sign-in; re-prompt on invalid or expired token (Owner: Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-02.1 |REQ-02: On login page the valid token gets passed | 1. | User loads to the login page and the google sign on button is displayed as a login option| Not Run |
| TC-02.2 |REQ-02: On login page an expired token gets passed | 1. |User loads to the login page and the google sign on button silently fails. A frontend error alert will be sent to our sql server for review | Not Run |
| TC-02.3 |REQ-02: On login page an invalid token gets passed | 1. | User loads to the login page and the google sign on button silently fails. A frontend error alert will be sent to our sql server for review| Not Run |

### 4.3 REQ-03 — Confirm amount, merchant, and selected card before charging (Owner: Luke / Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-03.1 | REQ-03: register purchase through our algorithm and route to correct card | 1. | Correct card gets chosen and moves on to the charging phase | Not Run |
| TC-03.2 | REQ-03: Register purchase through our algorithm and fail to route to correct card | 1. | An error occurred through our backend algorithm. Display "Card could not be chosen" | Not Run |
| TC-03.3 | REQ-03: Register purchase through our algorithm and default to bank account | 1. | All cards on file are inactive or have been disconnected. Display to user they need to pay with bank account. Route to bank account for charge. | Not Run |

### 4.4 REQ-04 — Highest effective-value card with tie-break order (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-04.1 | REQ-04: Verify that when two candidate cards yield the exact same effective point-multipler value for a merchant category, the tie-break algorithm correctly selects the card based on predefined deterministic priority rules (e.g., network preference or card priority order). | 3. |Configure a user wallet with two different cards that both offer a $3\%$ rewards rate (or 3x points) for a specific merchant category (e.g., dining). Simulate a checkout request at a dining merchant. Evaluate the recommendation engine's selected card output. | Not Run |
| TC-04.2 | REQ-04: Verify proper tie-break and valuation handling when a points-based card and a cashback card evaluate to the exact same normalized monetary return (e.g., assuming a standard point valuation baseline where 1 point = $1\text{¢}$, resulting in equivalent effective value). | 3. |Set up a user profile with Card A offering 2% cash back and Card B offering 2x times points (valued at 1 cent per point, equating to an effective 2% return). | Not Run |
| TC-04.3 | REQ-04: Verify that the selection algorithm correctly handles a 3-way tie across mixed reward mechanics (fixed cash back, tiered points, and flat-rate rewards) by applying the secondary tie-break sort attributes (e.g., card issuer ID or creation sequence). | 2. |Load a wallet containing three cards that calculate to the exact same effective reward percentage for the target transaction. Trigger the recommendation selection service. | Not Run |

### 4.5 REQ-05 — Charge by processor token with idempotency key (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-05.1 | REQ-05: Verify that a payment charge request succeeds when using a valid stored processor token and a unique idempotency key. | 2. |Send a POST request to /v1/charges with a valid processor token, amount, currency, and a unique Idempotency-Key header. | Not Run |
| TC-05.2 | REQ-05: Verify that repeating the exact same charge request with the same idempotency key returns the cached response without double-charging the user. | 2. | Send the initial charge request from TC-05.1 with Idempotency-Key: key_abc123. Resend the exact same payload and headers (Idempotency-Key: key_abc123) immediately after. | Not Run |
| TC-05.3 | REQ-05: Verify proper error handling when attempting to charge an invalid or expired processor token.  | 1. | Send a charge request using a malformed, expired, or non-existent processor token. | Not Run |

### 4.6 REQ-06 — Link cards via Plaid; verify webhook signature (Owner: Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-06.1 | REQ-06: Verify that a user can successfully link a funding source via Plaid and exchange the public token for an access token. | 2. |Initiate the Plaid Link flow on the client and obtain a temporary public_token. POST the public_token to the backend endpoint /v1/plaid/exchange. | Not Run |
| TC-06.2 | REQ-06: Verify that incoming webhook notifications from Plaid with a valid cryptographic signature are accepted and processed. | 1. | Send a simulated Plaid webhook payload to /v1/webhooks/plaid accompanied by a valid Plaid-Verification signature header. | Not Run |
| TC-06.3 | REQ-06: Verify that webhooks with forged, missing, or invalid signatures are rejected to prevent spoofing. | 1. | Send a webhook payload to /v1/webhooks/plaid with an incorrect or missing signature header. | Not Run |

### 4.7 REQ-07 — Return payment result to merchant and route back (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-07.1 | REQ-07: Verify that upon successful payment completion, the user/client is correctly routed back to the merchant's specified return URL with transaction status parameters. | 2. | Complete a checkout flow specifying a valid merchant return URL (redirect_uri). Finalize the payment authorization step. | Not Run |
| TC-07.2 | REQ-07: Verify that if a payment fails or is declined, the user is routed back to the merchant with an appropriate error status code. | 1. |Trigger a payment authorization that results in a decline from the processor. | Not Run |
| TC-07.3 |REQ-07: Verify that attempts to redirect to unwhitelisted or unauthorized merchant callback domains are blocked to prevent open-redirect vulnerabilities. | 1. | Initiate a checkout request providing an unwhitelisted external domain in the redirect_uri parameter. | Not Run |

### 4.8 NFR-01 — 95% of checkouts back to merchant within 5 s at 20 concurrent (Owner: Luke)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-16.1 | NFR-01: Verify that 95% of checkout transactions complete and return to the merchant flow within 5 seconds under a concurrent load of 20 users. | 2. | Configure a load-testing tool (e.g., k6 or Locust) to simulate 20 virtual users continuously executing the end-to-end checkout API flow. Run the test for a sustained period of 10 minutes. | Not Run |
| TC-16.2 | NFR-01: Confirm that connection pooling and database queries maintain performance benchmarks under concurrent stress. | 1. | Execute TC-16.1 while monitoring Azure SQL Database DTU/vCore utilization and API container CPU/memory usage. | Not Run |
| TC-16.3 | NFR-01: Verify system behavior if downstream processor latency spikes past thresholds during concurrent load. | 1. | Introduce simulated artificial latency (>5s) on downstream mock processor responses during a 20-concurrent user run. | Not Run |

### 4.9 NFR-03 — No PANs stored, logged, or passed through (Owner: Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-18.1 | NFR-03: Verify that primary account numbers (PANs / credit card numbers) are never written to the database tables or storage volumes. | 2. |Execute a full end-to-end transaction including card tokenization. Run comprehensive SQL queries searching all tables (transactions, logs, users) for patterns matching 13-to-19 digit card number formats. | Not Run |
| TC-18.2 |NFR-03: Verify that raw PANs do not appear in application console logs, file logs, or error monitoring systems (e.g., during exception stack traces). | 2. |Submit deliberate malformed payload tests containing test credit card numbers. Inspect application log output and error sinks.| Not Run |
| TC-18.3 |NFR-03: Verify that backend services do not pass raw PAN data downstream through internal microservices or unencrypted channels. | 1. |Capture internal network traffic / API requests passing between internal backend components during checkout. | Not Run |

### 4.10 NFR-04 — TLS 1.2+ in transit, AES-256 at rest (Owner: Maya)

| ID | Description | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-19.1 |NFR-04: Verify that the server rejects inbound connections attempting to negotiate obsolete TLS protocols (TLS 1.0 or TLS 1.1). | 1. |Use a security scanning tool (e.g., testssl.sh or OpenSSL client command) to attempt a handshake with the API using TLS 1.0 and TLS 1.1. | Not Run |
| TC-19.2 |NFR-04: Confirm that the endpoint uses strong cipher suites and valid certificate chains. | 1. |Inspect the SSL/TLS configuration using an external scanner (e.g., SSL Labs test). | Not Run |
| TC-19.3 |NFR-04: Confirm that Azure SQL Database and associated storage accounts enforce AES-256 encryption at rest. | 1. |Check Azure Portal / Azure CLI configurations for the SQL server and storage resources. | Not Run |

## 5. Test Environment


| Item | Development | Staging | Pilot |
| --- | --- | --- | --- |
| Hosting |Local developer machines (macOS / Windows WSL2) & Docker Compose |Azure App Service (Dev/Test tier) & Azure Static Web Apps |Azure App Service (Production tier) & Azure Static Web Apps |
| Operating systems |macOS Sonoma/Sequoia, Windows 11 (WSL2 Ubuntu 24.04) |Linux (Ubuntu 24.04 LTS container runtime) |Linux (Ubuntu 24.04 LTS container runtime) |
| Browsers and versions |Google Chrome (Latest), Mozilla Firefox (Latest), Safari |Google Chrome (Latest), Microsoft Edge (Latest), Safari |Google Chrome, Microsoft Edge, Safari, iOS Safari, Android Chrome |
| Mobile devices / emulators |iOS Simulator (Xcode 16), Android Studio Emulator (API 34+) |Physical Test Devices (iPhone, Android) via BrowserStack |Physical Test Devices (iOS / Android) under real network throttling |
| Backend runtime (Go version) |Go 1.23+ (Local development build) |Go 1.23+ (Containerized release candidate) |Go 1.23+ (Optimized production build with profiling) |
| Test tools (Go test, Jest, k6 versions) |go test, jest, k6 (v0.53+) |go test, GitHub Actions CI pipeline runners |Automated smoke suites & continuous telemetry monitors |
| Database (Supabase project) |Supabase Local (Docker container / local Postgres instance) |Supabase Staging Project (Isolated cloud instance) | Supabase Production-Mirror Project (Strict access controls)|
| Stripe mode |Stripe Test Mode (sk_test_... / pk_test_...) |Stripe Test Mode (sk_test_... / webhook simulation) |Stripe Test / Limited Live Sandbox (sk_test_... |
| Plaid environment |Plaid Sandbox (sandbox API keys, test institution IDs) |Plaid Sandbox (sandbox API keys with automated webhooks) |Plaid Sandbox / Select Pilot Partner Credentials |
| Seeded test data |Static JSON fixtures (testdata/merchants.json, mock cards) |Dynamically generated synthetic accounts and mock wallet states |Sanitized seed datasets matching anonymized pilot user cohorts |
| Network conditions |Unthrottled local loopback / Wi-Fi (127.0.0.1) |Simulated broadband (50 Mbps down / 10 Mbps up) |Throttled profiles (LTE / 4G, 100ms–250ms latency simulation via k6) |

## 6. Pass and Fail Criteria

### Per Test Case

* **Pass:** 
  The actual execution output matches the expected result precisely across all automated assertions, response codes, and payload structures, satisfying the tied metrics from Section 3 with zero deviations or unhandled error states.
* **Fail:** 
  The actual output deviates from the expected result (e.g., incorrect HTTP status codes, missing response parameters, failure to meet performance or encryption thresholds, or unhandled exceptions), violating the defined success criteria.
* **Blocked:** 
  A test case cannot be executed due to an upstream dependency failure, missing test environment prerequisites, third-party sandbox outage (such as Plaid or Stripe API unavailability), or an unresolved prerequisite bug.

### Plan as a Whole

* **Pass:** 
  All in-scope functional test cases (REQ-01 through REQ-07) and non-functional test suites (NFR-01 through NFR-04) achieve a 100 percent pass rate, with zero critical or high-severity defects open. Specifically, performance validation under `k6` confirms that 95 percent of checkouts complete within 5.0 seconds at 20 concurrent users, security audits verify zero raw PAN footprints and strict TLS 1.2+ / AES-256 compliance, and pilot sign-off is granted by stakeholders.
* **Fail:** 
  One or more critical path requirements fail verification (such as a failure in idempotency duplicate prevention, Plaid webhook signature verification bypass, a security vulnerability exposing raw PAN data, or checkout latency exceeding the 5.0-second threshold under load), or unaddressed high-severity defects remain unresolved prior to the deployment deadline.

## 7. Test Schedule

| Milestone | Test Activity | Owner | Evidence |
| :--- | :--- | :--- | :--- |
| **M6** | Unit test creation and execution for core backend services, card valuation normalization, and tie-break logic during active sprint development. | Luke & Maya | Automated test execution reports from CI/CD pipeline showing 100 percent unit test pass rate (`go test`, Jest). |
| **M9 (02/19/2027)** | Integration testing and system-level verification (Stripe charge tokenization, Plaid webhook signature validation, and database connection stability). | Luke & Maya | Integration test coverage reports, webhook verification logs, and initial `k6` concurrency baseline benchmarks. |
| **M12 (04/09/2027)** | System performance load testing under target concurrency (NFR-01) and final user acceptance testing (UAT) review prior to project demonstration. | Luke & Maya | `k6` performance test run summaries confirming checkout latency thresholds, security audit logs (zero-PAN checks, TLS/AES-256 validation), and pilot stakeholder sign-off documentation. |

## 8. Definition of Done

### Feature Level

* **Tests:** 
  All unit tests (`go test`, Jest) and integration test cases covering the specific feature requirements (such as REQ-05 token charging or REQ-06 Plaid webhook verification) are written, executed successfully, and integrated into the automated CI/CD pipeline.
* **Review:** 
  Code has undergone a mandatory peer review via GitHub pull request, ensuring adherence to coding standards, secure data handling (zero-PAN storage), and architectural patterns.
* **Documentation:** 
  API endpoints, data models, and component changes are documented with clear inline comments, updated OpenAPI/Swagger specifications, and relevant architectural notes.
* **Open defects:** 
  Zero critical or high-severity defects remain open for the feature; any minor bugs are logged in the project tracker with designated ownership.
* **Sign-off:** 
  Approved by the feature owner (Luke or Maya) upon successful verification against acceptance criteria.

### Project Level

* **Tests:** 
  100 percent of in-scope functional and non-functional test suites (including NFR-01 load tests confirming 95 percent of checkouts complete within 5.0 seconds at 20 concurrent users, and NFR-04 security compliance scans) achieve a passing status.
* **Review:** 
  Comprehensive end-to-end system architecture and security reviews completed across all integrated modules (Go backend, React/React Native clients, Supabase database, and third-party APIs).
* **Documentation:** 
  Complete project documentation package finalized, including system specification, test plans, API integration guides, deployment instructions, and user manuals.
* **Open defects:** 
  All critical, high, and medium-severity bugs are fully resolved, tested, and closed across the entire system.
* **Sign-off:** 
  Formal project sign-off granted by the faculty advisor and pilot stakeholder group ahead of final milestone presentations.
