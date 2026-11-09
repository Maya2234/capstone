# CardStack — Ethics Statement

**Team:** Luke Brogee, Maya Tomarchio  
**Faculty Advisor:** Dr. Aurisano  
**Documentation Lead:** Maya Tomarchio
**Version:** 0.1 (draft) · **Date:** 11/08/2026  
**Traces to:** [Requirements Document](Requirements_Document.md) v1.0, [Technical Specification](Technical_Specification.md) v1.0 (§3 database schema, §4 technology stack), [Constraints Essay](Constraints_Essay.md) (Week 3)

## 1. Version and Change Log

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| 0.1 | 11/08/2026 | Initial draft. Privacy, security, licensing, attribution, and AI-use sections built from the repository, the Technical Specification v1.0 schema, and the `app/` prototype. | Maya + Luke |

Each section is checked by the member who owns the relevant components (Tasklist.md):

| Section | Checked by | Why |
| --- | --- | --- |
| 2. Privacy Summary | Maya Tomarchio | Owns Authentication & User Account, Card/Payment Information Store, Financial Institution Setup |
| 3. Security Summary | Maya Tomarchio, Luke Brogee | Authentication (Maya); Checkout Button, Card Processing, Merchant webhook (Luke) |
| 4. Licensing Summary | Luke Brogee | Owns the mobile and checkout clients that carry most dependencies |
| 5. Attribution List | Luke Brogee | Same as Section 4 |
| 6. AI-Use Disclosure | Both members | Each member records their own use |

## 2. Privacy Summary

CardStack is a payment method, so it handles some of the most sensitive data a consumer has. Our rule is to collect only what is needed to pick the best card and complete a charge. Full card numbers (PANs) never reach CardStack: cards are linked through Plaid, and charges use a processor token instead of the card number (NFR-03, CON-05). The table covers every data item that crosses an arrow on the D0 to D2 diagrams, using the table names from Technical Specification §3.

| Data item | Source | Purpose | Consent | Storage | Access | Retention |
| --- | --- | --- | --- | --- | --- | --- |
| Email, Google account ID (`sub`), display name | Google Sign-In (I2, I7) | Identify the account; send receipts | Google's consent screen at first sign-in names the data shared with CardStack | `user` table | API service only | Until the user deletes their account |
| Session token | Issued by the API | Keep the user signed in | Part of signing in | Only a SHA-256 hash is stored (`session.token_hash`) | API service only | Expires after 30 minutes of inactivity (NFR-05); deleted on logout or expiry |
| Plaid item ID and account IDs | Plaid Link (I9) | Link institutions and accounts | Plaid Link's consent screen; the user picks which accounts to share | `institution_link`, `user_card`, `linked_account` | API service only | Until the card or institution is removed, or the account is deleted |
| Processor token | Plaid, for Stripe | Charge a card without seeing the PAN (REQ-05) | Given when the card is linked | Encrypted with AES-256-GCM (`user_card.processor_token`); the key is held outside the database in the secret manager | API service only; never returned by any endpoint (verified by TC-18) | Until the card is removed |
| Last 4 digits, network, card product, credit limit, balance | Plaid | Show the card; exclude cards without enough credit; utilization tie-break (REQ-04) | Given when the card is linked | `user_card` | API service; the owning user | Same as processor token |
| Chosen bonus categories and activated rotating categories | Entered by the user in the app | Apply the right reward rate | The user enters them | `user_card.choices`, `user_card.rotating_active` | API service; the owning user | Same as processor token |
| Bank account name, type, last 4, balance | Plaid | Financial overview in the app | Plaid Link consent; user chooses the accounts | `linked_account` | API service; the owning user | Until the institution is removed |
| Spending history from linked accounts (merchant, category, amount, date) | Plaid transactions | Spending by category, missed-rewards insight | Plaid Link consent, plus an in-app notice before the first link | `external_transaction` | API service; the owning user | kept until account deletion |
| CardStack transaction (order ID, amount, category, card used, state, rewards earned) | Merchant checkout session and consumer checkout | Process the payment; transaction history (REQ-11) | The consumer sees the amount, merchant, and card and clicks Purchase (REQ-03) | `transaction`, `charge_attempt`, `selection_log` | API service; the owning user; the merchant sees only its own orders | until account deletion |
| Merchant webhook payload (order ID, transaction ID, state, amount) | API to merchant (I6) | Confirm the order | Covered by the merchant agreement | `webhook_delivery` | Merchant, verified by HMAC signature | 90 days |
| Receipt email | `user.email` | Send the receipt (REQ-13) | receipt opt-in | `notification` | API service | until account deletion |
| Merchant name, webhook URL, API key, button domain | Merchant onboarding | Run the Checkout Button and webhooks | Merchant agreement | `merchant` (API key stored hashed), `checkout_button` | API service | Until the merchant leaves |
| Server logs | API | Debugging and security monitoring | Privacy notice | Server output (Azure App Service logs in production) | Team | 30 days|

**How consent is obtained.** Users consent three times: on Google's sign-in screen, on Plaid Link's account-sharing screen, and on the CardStack confirm screen before every purchase. Consent is never implied by use.

**When the project ends.** If project is decomissioned, all user data will be deleted.

**Fields we removed.** We never collect the full card number, CVV, or card PIN, because Plaid and Stripe handle them.

## 3. Security Summary

The Week 3 constraints essay committed us to security that is "planned, documented, tested and overseen" (CON-03). This section shows how the design meets the three most common capstone gaps.

| Gap | How we addressed it |
| --- | --- |
| Default credentials | CardStack has no admin accounts and stores no passwords; consumers sign in with Google. The local development merchant keys (`msk_demo_threadline`, `whsec_demo_threadline`, `plaid-sandbox-secret`) only work when `CARDSTACK_DEV=1`. Outside development mode, the server refuses to start without a real encryption key (`CARDSTACK_TOKEN_KEY`). |
| Unauthenticated endpoints | Every consumer endpoint requires a session token. Merchant endpoints require a merchant API key, stored hashed. The Plaid webhook is rejected unless its HMAC signature verifies (TC-06). `GET /button/{id}` only answers for the button's registered domain (REQ-01). `GET /checkout/{id}` is public by design so the checkout page can load, but it uses an unguessable UUID and returns no personal data. |
| Secrets in source control | All keys come from environment variables, held in Azure Key Vault in production (Technical Specification §4). The local database and the generated development key live in `app/server/data/`, which is git-ignored. |

**Mechanisms**

| Mechanism | Detail |
| --- | --- |
| Authentication | Google ID tokens, verified against our Google client ID (REQ-02) |
| Session tokens | 256-bit random tokens; only a SHA-256 hash is stored; expire after 30 minutes of inactivity (NFR-05) |
| Merchant authentication | Secret API key per merchant, stored as a SHA-256 hash |
| Webhooks | HMAC-SHA256 signatures on inbound Plaid and outbound merchant webhooks (NFR-05) |
| Encryption at rest | Processor tokens encrypted with AES-256-GCM (NFR-04); database encryption at rest from Supabase |
| Encryption in transit | HTTPS with TLS 1.2 or higher at Azure App Service (NFR-04) |
| Where secrets live | Azure Key Vault in production; environment variables locally; never in the repository |
| Rate limiting | |

**Git history search.** On 11/05/2026 we searched every commit on every branch (57 commits) with `git log --all -p`. We looked for Stripe and AWS key formats, private keys, and assignments to `api_key`, `secret`, `client_secret`, and `password`, and for committed `.env`, `.db`, `.pem`, and key files. **No real secrets were found.** The only matches were placeholder text (`sk_test_...`) in the test plan's environment table, the development-only defaults listed above, and a test constant (`msk_test`) in the API tests. Nothing needed to be removed from history. 

| Self-audit question | Answer |
| --- | --- |
| Are there default or hard-coded passwords? | No. There are no passwords; development keys only work in development mode. |
| Can any endpoint read or change user data without authentication? | No. See the gap table above. |
| Are any secrets in the git history? | No. See the search above. |
| Are processor tokens or PANs ever logged or returned by the API? | No. Tokens are encrypted and never returned (TC-18); PANs never enter the system. |
| Is all traffic encrypted? | Yes in production (TLS 1.2+); local development uses plain HTTP on localhost. |
| Is there rate limiting on sign-in and payment? | Not yet. |
| Who can read the database? | Only the API service role.|

## 4. Licensing Summary

**Project license:** Project license: CardStack is released under the MIT License (SPDX: MIT). It is compatible with every row below because all dependencies are permissive (MIT, BSD, Apache-2.0) and the one copyleft build tool (lightningcss, MPL-2.0) is not modified or shipped.

| Name | Version | License (SPDX) | Type | Obligation |
| --- | --- | --- | --- | --- |
| Go toolchain and standard library | 1.27.3 | BSD-3-Clause | Permissive | Keep the copyright notice |
| modernc.org/sqlite | 1.61.1 | BSD-3-Clause (wraps SQLite, public domain) | Permissive | Keep the notice |
| modernc.org/libc | 1.79.0 | BSD-3-Clause (includes musl, MIT) | Permissive | Keep both notices |
| modernc.org/mathutil | 1.7.1 | BSD-3-Clause | Permissive | Keep the notice |
| modernc.org/memory | 1.12.1 | BSD-3-Clause | Permissive | Keep the notice |
| golang.org/x/sys | 0.49.0 | BSD-3-Clause | Permissive | Keep the notice |
| github.com/remyoudompheng/bigfft | v0.0.0-20230129 | BSD-3-Clause | Permissive | Keep the notice |
| github.com/dustin/go-humanize | 1.1.0 | MIT | Permissive | Keep the notice |
| github.com/mattn/go-isatty | 0.0.24 | MIT | Permissive | Keep the notice |
| github.com/ncruces/go-strftime | 1.1.0 | MIT | Permissive | Keep the notice |
| react, react-dom | 19.3.0 | MIT | Permissive | Keep the notice |
| react-native | 0.88.1 | MIT | Permissive | Keep the notice |
| react-native-web | 0.21.4 | MIT | Permissive | Keep the notice |
| expo | 58.0.23 | MIT | Permissive | Keep the notice |
| expo-router | 58.0.30 | MIT | Permissive | Keep the notice |
| expo-constants, expo-linking, expo-status-bar, @expo/metro-runtime | 58.0.15, 58.0.16, 58.0.4, 58.0.17 | MIT | Permissive | Keep the notice |
| @expo/vector-icons (includes Ionicons font) | 15.1.1 | MIT | Permissive | Keep the notice |
| @react-native-async-storage/async-storage | 2.2.0 | MIT | Permissive | Keep the notice |
| react-native-safe-area-context | 5.11.1 | MIT | Permissive | Keep the notice |
| react-native-screens | 4.30.1 | MIT | Permissive | Keep the notice |
| typescript (development only) | 6.0.3 | Apache-2.0 | Permissive | Keep the notice; not shipped |
| eslint, eslint-config-expo (development only) | 9.39.5, 58.0.4 | MIT | Permissive | None; not shipped |
| **lightningcss** (build tool, via Expo) | 1.33.0 | **MPL-2.0** | **Weak copyleft** | Changes to its own source files must be shared; not modified or shipped by us |
| **node-forge** (Expo CLI) | 1.4.3 | BSD-3-Clause **OR GPL-2.0** | Dual-licensed | We elect BSD-3-Clause |
| caniuse-lite (build data) | 1.0.30001820 | CC-BY-4.0 | Permissive | Credit the source if redistributed; not shipped |
| Other build-time packages (about 770) | various | MIT, ISC, Apache-2.0, BSD-2/3-Clause, BlueOak-1.0.0, Unlicense, Python-2.0, 0BSD | Permissive | None beyond keeping notices; not shipped in the app |
| Plaid API, Stripe API, Google Sign-In | hosted services | Terms of service, not open-source licenses | n/a | Follow each provider's developer terms; sandbox use only during the course |
| Card rewards dataset (`app/data/card_products.json`) | as of 11/04/2026 |  owned by the team | n/a | Facts compiled from public issuer pages; issuer and card names are trademarks used only to describe the products |
| Expo template app icons and splash images (`app/consumer/assets/`) | SDK 58 | MIT | Permissive | Keep the notice; replace with our own icons before release |

**Compatibility.** Every row is permissive or a hosted service, so the project can use any common license, including MIT. **Copyleft decisions:** lightningcss (MPL-2.0) is a build tool that we do not modify or distribute, so its file-level copyleft creates no obligation for us. node-forge is dual-licensed and we take the BSD-3-Clause option. No GPL code is included in anything we ship.

## 5. Attribution List

**Libraries**

| Library | Source | License |
| --- | --- | --- |
| modernc.org/sqlite, libc, mathutil, memory | https://gitlab.com/cznic/sqlite | BSD-3-Clause |
| golang.org/x/sys | https://go.googlesource.com/sys | BSD-3-Clause |
| go-humanize | https://github.com/dustin/go-humanize | MIT |
| go-isatty | https://github.com/mattn/go-isatty | MIT |
| go-strftime | https://github.com/ncruces/go-strftime | MIT |
| bigfft | https://github.com/remyoudompheng/bigfft | BSD-3-Clause |
| Expo, Expo Router, Expo modules | https://github.com/expo/expo | MIT |
| React, React DOM | https://github.com/facebook/react | MIT |
| React Native | https://github.com/facebook/react-native | MIT |
| React Native Web | https://github.com/necolas/react-native-web | MIT |
| @expo/vector-icons | https://github.com/expo/vector-icons | MIT |
| Async Storage | https://github.com/react-native-async-storage/async-storage | MIT |
| Safe Area Context | https://github.com/AppAndFlow/react-native-safe-area-context | MIT |
| React Native Screens | https://github.com/software-mansion/react-native-screens | MIT |

**Adapted code**

| What | Source |
| --- | --- |
| Consumer app project scaffold | Expo `blank-typescript` template (MIT), created with `create-expo-app` |
| Tab layout and protected-route setup | Expo Router documentation examples, https://docs.expo.dev/router |
| Test-card convention (card ending 0002 declines, 0010 times out) | Modeled on Stripe's published test card numbers, https://docs.stripe.com/testing |

**Datasets**

| Dataset | Collection method | Usage restrictions |
| --- | --- | --- |
| Card rewards data (43 cards, 11 issuers) | Compiled by hand from public issuer product pages; each row records its `sourceUrl`, an `asOf` date, and a confidence label | Reward rates are facts and change often; must be verified before relying on them. Issuer and card names are trademarks of their owners. |
| Sandbox institutions and spending history | Generated by the mock Plaid adapter; no real people or accounts | None; synthetic data |

**Non-code assets**

| Asset | Author | License |
| --- | --- | --- |
| Ionicons (tab bar icons) | Ionic | MIT |
| App icon, splash, favicon | Expo template | MIT |
| CardStack logo mark (three stacked cards) | Maya | Team-owned |

## 6. AI-Use Disclosure

> "Generative AI tools may be used for drafting and code assistance but not for the design decisions or written analysis that are assessed in this course."

| Tool | Used by | Task | Column | How verified |
| --- | --- | --- | --- | --- |
| Claude (Claude Code) | Maya Tomarchio | Generated proof of concept demo in `app/` (Go API, consumer app, merchant demo) from the team's Technical Specification | Generally OK | 15 Go unit and API tests pass; TypeScript typecheck and lint pass; full checkout run in the browser; reviewed by Maya |
| Claude (Claude Code) | Maya Tomarchio | Compiled the 43-card rewards dataset | Generally OK | Each row links to the issuer page; |
| Claude (Claude Code) | Maya Tomarchio | Drafted the Test Plan submission checklist and an empty Test Plan skeleton (metrics, test cases, and definition of done left blank) | Generally OK | The team wrote all metrics, test cases, and the definition of done |
| Github Copilot | Luke Brogee | Help assist in code development for backend api service | Generally Ok | The team builds use cases for expected results and 'go' tests for algorithms and packages built using Copilot |

**Confirmation**

I confirm that the architecture, data model, priorities, and design rationale of CardStack were the team's own. — Maya Tomarchio, date 11/8/2026

I confirm that the architecture, data model, priorities, and design rationale of CardStack were the team's own. — Luke Brogee, date 11/8/2026

---
