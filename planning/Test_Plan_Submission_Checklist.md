# Test Plan — Submission Checklist

Working checklist for the Week 10 Test Plan deliverable. Team: Luke Brogee, Maya Tomarchio. Not a submitted document; it tracks what `Test_Plan.md` has to contain before we turn it in.

## 1. Logistics

- [ ] One file, `Test_Plan.md`, committed to the **repository root** next to `Requirements_Document.md` and `Technical_Specification.md`.
- [ ] Target length: **5 to 8 pages** as a PDF.
- [ ] Both team member names (Luke Brogee, Maya Tomarchio) at the top of the document.
- [ ] Exported to PDF and **submitted separately by each of us** (Luke and Maya each upload the same PDF).
- [ ] Owner: Luke (Coordinator and Test Owner, per the Team Contract). Each component owner writes the test cases for their own components (see section 5 below).
- [ ] The eight part names below used **exactly** as section headings, in this order.
- [ ] `Test_Plan.md` added to the file list in `README.md` Section 3.
- [ ] `Test_Plan.md` added to the appendix (in the Technical Specification and/or the Final Design Report appendix, wherever the appendix lives).

## 2. Required sections (use these as the headings)

### Part 1 — Scope

- [ ] **In scope**, listed by requirement ID **and** component (e.g. REQ-04, Transaction & Card Selection Service).
- [ ] **Out of scope**, each item with a reason:
  - [ ] Deferred Won't items (Requirements Document Section 7): stage two card and tap payments, our own processor, full PAN handling, refunds and chargebacks, non-USD and non-US, recurring payments, merchant analytics dashboard, non-Google sign-in.
  - [ ] Any Could items (REQ-13, REQ-14, REQ-15, NFR-07) we decide not to test this cycle.
  - [ ] Known limitations (e.g. Stripe and Plaid run in sandbox mode only).
  - [ ] Third-party components we will not retest: Google Sign-In, Plaid Link, Stripe, Supabase, Azure. We test our integration with them, not the services themselves.

### Part 2 — Verification and validation strategy

- [ ] About **half a page**.
- [ ] Which requirements are **verified** against the spec by the team (most REQ and NFR items with the method Test or Inspection).
- [ ] Which requirements are **validated** against stakeholder needs by users or our advisor (Dr Aurisano), e.g. the usability items NFR-06 and NFR-07 and the Demonstration items REQ-03, REQ-11, REQ-12, REQ-14.
- [ ] **Test-pyramid table** with columns: layer, approximate count, coverage focus (unit, integration, system, acceptance).
- [ ] We are not a hardware, sensor, or ML project, so variables, metrics, tolerance, and trials are not required. Say that in one line.

### Part 3 — Measurable success criteria

- [ ] Table with columns: **metric, target threshold, how it is measured, requirement ID**.
- [ ] Covers performance, reliability, usability, and accuracy.
- [ ] One row for every NFR (NFR-01 to NFR-09) and for every numeric condition in a functional requirement, for example:
  - REQ-09: 5 retry attempts, exponential backoff
  - REQ-10: 10 s timeout, resolved within 15 min
  - REQ-11: 20 items per page
  - REQ-13: receipt within 1 min
- [ ] No metric without a requirement ID, and no requirement without a metric.
- [ ] Tip from the brief: write this table **first**, because it drives Parts 4 and 6.

### Part 4 — Test cases

- [ ] **Five-column template**: ID, Description, Steps, Expected Result, Status.
  - Description names what is tested **and** the requirement ID it traces to.
  - Steps are numbered and reproducible by someone who is not on the team.
  - Expected Result is specific and measurable.
  - Status is one of Pass, Fail, Blocked, or Not Run (all **Not Run** at submission).
- [ ] **At least 3 cases per major requirement.** Every Must is major, so we need at least these 10 groups (30+ cases):
  REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, NFR-01, NFR-03, NFR-04.
  Decide which Should items also count as major and list them.
- [ ] **Each group includes at least one edge case or failure condition.** Take these from the D2 edge cases (EC-01 to EC-09) and the error codes (ButtonNotAllowed, AuthInvalidToken, AuthExpired, invalid Plaid signature, and so on) rather than inventing them.
- [ ] IDs match the Test Case column of the traceability matrix (Technical Specification Section 6).

> ⚠️ **ID conflict to resolve.** The matrix currently gives each requirement a single ID (REQ-04 → TC-04). Three or more cases per requirement need sub-IDs, for example TC-04.1, TC-04.2, TC-04.3. If we do that, we have to:
> - [ ] Update the Test Case column of the traceability matrix in `Technical_Specification.md`.
> - [ ] Add a row to the Technical Specification version log describing the renumbering.

### Part 5 — Test environment

- [ ] Hardware, software, data, and configuration, with **versions**:
  - [ ] OS and browser versions for the web app.
  - [ ] Mobile devices or emulators for the React Native app.
  - [ ] Go version, Node and Jest versions, k6 version.
  - [ ] Sandbox accounts and keys for Supabase, Stripe, and Plaid (named only, never written into the doc).
- [ ] Seeded test data: test users, linked sandbox cards, reward rules, registered button IDs and allowed domains.
- [ ] Network conditions (e.g. a simulated processor timeout for REQ-10, and 20 concurrent checkouts for NFR-01).
- [ ] **Development, staging, and pilot environments described separately.**

### Part 6 — Pass and fail criteria

- [ ] An objective threshold for **each test** and for **the plan as a whole**.
- [ ] Both the pass condition **and** what counts as a failure.
- [ ] Tied back to the Part 3 metrics.

### Part 7 — Schedule

- [ ] Table with columns: **milestone, test activity, owner, evidence**.
- [ ] Each layer placed against the **Week 8 (D3) milestones**: unit and integration during sprints, system and acceptance before reviews and demos. Known anchors: M6 (advisor/faculty review), M9 (02/19/2027, uptime monitoring starts), M12 (04/09/2027). Fill in the rest from `D3__Assignment8.docx`.
- [ ] Ordered by risk: core checkout flow and data integrity first (REQ-04, REQ-05, REQ-06, NFR-03, NFR-09).
- [ ] Evidence named for every row (test report, CI run, k6 output, usability notes, advisor sign-off).

### Part 8 — Definition of done

- [ ] **Feature-level** checklist: tests, review, documentation, open defects, sign-off.
- [ ] **Project-level** version of the same checklist.

## 3. Component owners (from `Tasklist.md`)

Each person writes the cases for the components they own.

| Component | Owner | Requirements |
| --- | --- | --- |
| Checkout Button | Luke | REQ-01, NFR-02 |
| Authentication & User Account | Maya | REQ-02, NFR-05 |
| Card/Payment Information Store | Maya | NFR-03, NFR-04 |
| Transaction & Card Selection Service | Luke | REQ-04, REQ-15 |
| Card Processing | Luke (integration), Maya (state machine) | REQ-05, REQ-08, REQ-10, NFR-09 |
| Financial Institution Setup | Maya | REQ-06 |
| Merchant webhook | Luke | REQ-07, REQ-09 |
| Transaction history | Luke | REQ-11 |
| Receipt forwarding | Maya | REQ-13 |
| Mobile app & Web app | Luke (mobile), Maya (web) | REQ-03, REQ-12, REQ-14, NFR-06, NFR-07 |
| End-to-end checkout | Luke | NFR-01 |

NFR-08 (uptime) is not tied to one component; assign an owner when we write the schedule.

## 4. Grading map

| Criterion | Points | Sections it depends on |
| --- | --- | --- |
| Scope clarity | 20 | Part 1 |
| Test case quality | 35 | Part 4 |
| Pass and fail criteria | 25 | Parts 3, 6, 8 |
| Environment and schedule | 20 | Parts 5, 7 |

## 5. Final checks before submitting

- [ ] Every Must requirement has 3+ cases, including an edge or failure case.
- [ ] Every TC ID appears in the traceability matrix, and every matrix TC ID appears in the plan.
- [ ] Every metric has a requirement ID, and every NFR has a metric.
- [ ] Trade two test cases with another team. If they have to ask a question to run one, rewrite its steps.
- [ ] Metrics, test cases, and the definition of done are our own work (course generative-AI policy).
- [ ] README Section 3 and the appendix updated; Tech Spec version log updated if IDs changed.
- [ ] PDF exported, both names on it, submitted by both members; source committed and pushed.
