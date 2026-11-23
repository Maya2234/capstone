# Assignment #10: Final Design Report checklist

Team: Luke Brogee, Maya Tomarchio. Advisor: Dr. Aurisano.

Three deliverables plus the advisor form:

1. **Team:** the final design report. This is `README.md`, rewritten into 10 sections. Both of you submit the repo link and a PDF of the README.
2. **Individual:** a design notebook each, committed to `notebooks/` and uploaded as a PDF.
3. **Individual:** a team and self assessment, uploaded as a PDF. **Do not commit it.**
4. **Individual:** a signed advisor assessment from Dr. Aurisano, as a PDF.

The repo already has nearly all the source material. The work is mostly **reconciling, reorganizing and filling a few gaps**. The order below matters: reconcile first, then assemble.

---

## Step 0. Do these today (they depend on other people)

- [ ] **Email Dr. Aurisano for the Project Advisor Assessment.** It's required, it depends on their schedule, and it's submitted separately by each of you. Ask which form they use and when they can sign it.
- [ ] **Agree the split with Luke.** Suggested:
  - **Maya:** sections 1, 3 (traceability), 9 and 10, plus the final link check.
  - **Luke:** sections 4, 5 and 8, plus the missing test cases.
  - **Each of you:** your own section 7 essay, notebook and assessment.
- [ ] **Commit the work currently in progress** (the demo stores and dev-preview changes) or set it aside, so the tagged commit is clean.

---

## Step 1. Reconcile the documents (do this before writing the README)

These are the inconsistencies the assignment warns about. I checked the repo for each one.

### 1a. Choose one product name
- [ ] **The app is CardMaxx, but most documents still say CardStack.** "CardStack" appears 18 times in `Requirements_Document.md`, 10 in `ethics_statement.md`, 8 in `Technical_Specification.md`, 6 in `User_Stories.md`, 5 each in `Constraints_Essay.md` and `Test_Plan.md`, and in `Project-Description.md`, `Tasklist.md` and `README.md`. Also check the D0–D2 PDFs and the slides.
- [ ] **Pick one approach:**
  - **Rename everywhere** (recommended), or
  - **Keep old files as they are,** and add one line to the README and the spec's version log: "CardStack was renamed CardMaxx in November."

### 1b. Make the Technical Specification match what you actually built
The spec describes the **design-phase** system, and the main app has since moved on:

| Spec says | `client/` (main branch) actually uses |
| --- | --- |
| Go API on Azure App Service | Expo Router API routes (`client/src/app/api/`) |
| Google sign-in | Supabase email and password sign-in, with optional two-factor; Google is planned |
| Stripe charges, merchant Checkout Button, webhooks | Simulated checkout (demo stores); the `feature/cardstack-prototype` branch still has the Go checkout flow with mock Plaid and Stripe |
| Azure Key Vault | `.env` locally; production secret storage still to be chosen |

- [ ] **Add a version log entry to the spec** (Section 1) listing these changes and why.
- [ ] **Update Section 2 (Architecture) and Section 4 (Technology Stack)** to describe both what was built and what is still planned.
- [ ] **Check that the D2 PDF's component names match the updated spec.** If D2 is from an earlier week and no longer matches, either update the diagram or label it "D2 (design-phase; superseded by the spec, Section 2)". The assignment says a stale diagram costs more than missing polish.

### 1c. Fix the test plan so the traceability matrix has no orphans
- [ ] **The matrix in `Technical_Specification.md` Section 6 refers to test cases TC-01 to TC-27,** but `Test_Plan.md` only defines **TC-01–TC-07, TC-16, TC-18 and TC-19.**
  - Requirements with **no test case** in the test plan: **REQ-08, REQ-12, REQ-14, REQ-15**, and NFR-02 and NFR-05 to NFR-09, plus all CON items.
  - Test IDs named in the matrix but **missing from the test plan**: TC-08–TC-15, TC-17 and TC-20–TC-27.
- [ ] **Add a short test case to `Test_Plan.md` for each missing ID.** One table each, in the same format as 4.1–4.10, is enough. Inspection-type tests (CON-01, CON-04) can be one line: what is checked, by whom, and what passes.
- [ ] **Where something was built differently,** for example REQ-02 (now email sign-in, not Google), update the requirement or the test case so they agree. Don't leave a test that can't pass.
- [ ] **Check every design element named in the matrix exists** in D0/D1/D2 or the spec, under the same name.

---

## Step 2. Rewrite `README.md` as the report

The current README is a file table and an attribution list. Replace it with this structure. Put the **linked table of contents** at the top, listing the 10 official titles in this exact order. The current file table and attribution list can move into Section 10.

```markdown
# CardMaxx: Final Design Report

## Table of Contents
1. [Team Names and Project Abstract](#1-team-names-and-project-abstract)
2. [Project Description](#2-project-description)
3. [User Stories and Design Diagrams](#3-user-stories-and-design-diagrams)
4. [Project Tasks and Timeline](#4-project-tasks-and-timeline)
5. [ABET Concerns Essay](#5-abet-concerns-essay)
6. [PPT Slideshow](#6-ppt-slideshow)
7. [Self-Assessment Essays](#7-self-assessment-essays)
8. [Professional Biographies](#8-professional-biographies)
9. [Budget](#9-budget)
10. [Appendix](#10-appendix)
```

Sections 1, 9 and 10 must be written fresh. Sections 2–8 can be short summaries, but **each must link to its full document** (one click).

### Section 1: Team Names and Project Abstract (write fresh)
- [ ] **List the team and advisor:** Luke Brogee, Maya Tomarchio. Advisor: Dr. Aurisano. Add majors and emails if you like.
- [ ] **Write an abstract of at most 400 ASCII characters** (characters, not words). Draft (340 characters, all ASCII, checked):

  > CardMaxx is a payment app that links a user's credit cards through Plaid and, at checkout, picks the card that earns the most rewards for the purchase category. It also tracks spending and budgets across linked accounts. Built with Expo (web, iOS, Android), Supabase and Plaid, it never stores card numbers and encrypts bank tokens at rest.

- [ ] **Count your final version, and make sure it uses straight quotes and apostrophes.** Curly quotes, as Word and Google Docs insert them, are not ASCII. To check, run `python -c "s=open('abstract.txt').read().strip(); print(len(s), s.isascii())"`.

### Section 2: Project Description
- [ ] **Summarize `Project-Description.md`** in 1–2 paragraphs, covering the problem, who it's for, and stage one versus stage two. Link the file.
- [ ] **Update `Project-Description.md` itself** with the new name and the current scope.

### Section 3: User Stories and Design Diagrams (the most heavily graded section)
- [ ] **User stories:** summarize US-01–US-03 and UC-01 from `User_Stories.md`, and link it.
- [ ] **Diagrams:** link or embed the D0, D1 and D2 diagrams, which are `Design_Diagrams/D0BlockDiagram.png`, `D0_High_Level_Design.pdf`, `D1_Detailed_Design.pdf` and `D2_Detailed_Design.pdf`. `SuccessFlow.png` can be embedded too.
- [ ] **Conventions:** add a short list of the conventions you use:
  - **IDs:** REQ-xx, NFR-xx, CON-xx, TC-xx, US-xx, UC-xx, T-xx.
  - **Money:** amounts stored in cents.
  - **API style:** REST over HTTPS with JSON.
  - **Code layout:** screens in `client/src/app`, components in `client/src/ui`, data logic in `client/src/data`, server code in `client/src/server`.
  - **Naming:** how files and components are named.
- [ ] **Components:** give a one-line purpose for each component. Use the D0/D2 component list, for example Checkout Interface, Card Selection Service, Card/Payment Information Store, Authentication, Plaid integration, merchant webhooks, and the apps.
- [ ] **Links:** link `Requirements_Document.md`, `Technical_Specification.md` and `Test_Plan.md`.
- [ ] **Traceability matrix:** put it **here, in the README**. Rebuild it from the reconciled spec Section 6 after Step 1c, with these columns: Req ID | Requirement | Design element | Test case(s) | Status.
  - Every REQ, NFR and CON row needs at least one design element and at least one test ID that **exists** in `Test_Plan.md`.
  - Every test case in `Test_Plan.md` must appear in the matrix, so there are no orphans in either direction.
  - Keep the spec's Section 6 in sync with this copy, or replace it with "see README Section 3".

### Section 4: Project Tasks and Timeline
- [ ] **Summarize `Tasklist.md`** (T-01 onward, with modules and owners) and link it, along with `planning/D3_Effort_Matrix.xlsx`.
- [ ] **Add a timeline. It's missing:** `Tasklist.md` has tasks and owners but no dates. Add a milestone table or Gantt chart covering this semester (done) and next semester (planned):
  - **Done this semester:** requirements, D0–D3, test plan, design presentation on 11/17, prototype, CardMaxx app with Plaid and Supabase.
  - **Planned for next semester:** the remaining items in the spec's "Next steps".

### Section 5: ABET Concerns Essay
- [ ] **Summarize `Constraints_Essay.md`** and link it.
- [ ] **Clean up the essay itself:**
  - The paragraphs are written as `####` headings. Change them to normal text.
  - Fix the typos: "Finanical", "entereed", "approprite", "opportuntiies".
  - Update the security paragraph. It says users sign in with Google rather than a password, but the app uses email and password with optional two-factor.
- [ ] **Check it covers the constraint areas your course requires.** It has Economic, Professional and Security. If the rubric lists others, such as legal, ethical, social or environmental, add a short paragraph for each.

### Section 6: PPT Slideshow
- [ ] **Link `Presentation/CardMaxx_Design_Presentation.pptx` and its PDF.** The PDF is the one-click version.
- [ ] **Optionally**, list the older CardStack draft as superseded, and link `Advisor_Feedback.md` for the advisor's comments.

### Section 7: Self-Assessment Essays
- [ ] **These aren't in the repo yet.** If you each wrote an individual self-assessment essay earlier in the semester, add both, for example `essays/tomarchio_self_assessment.md` and `essays/brogee_self_assessment.md`. Summarize them in a few lines each and link them.
- [ ] **Don't confuse these with the Step 4 team and self assessment.** That one holds peer ratings and must **not** be committed.

### Section 8: Professional Biographies
- [ ] **Summarize `Professional-Biographies.md`** in one line per person and link it.
- [ ] **Make the two bios consistent.** Luke's uses different heading levels from Maya's (for example `## Work Experience` versus `### **Work Experience**`).

### Section 9: Budget (write fresh)
- [ ] **State expenses to date.** If none, say "No expenses to date" and explain that everything runs on free tiers:
  - **Supabase:** free plan.
  - **Plaid:** Trial or Sandbox.
  - **Resend:** free tier.
  - **Expo:** free.
  - **GitHub:** free.
- [ ] **Check this is true first.** Did anyone pay for a domain, an Apple developer account ($99/year), a Google Play account ($25), or a paid Plaid plan?
- [ ] **Donated items:** list any, with their value and source. If there are none, say so.

### Section 10: Appendix (write fresh)
- [ ] **References:**
  - Plaid, Supabase, Expo and Stripe documentation.
  - The card issuer pages used for the reward data.
  - Any papers or articles you cited.
- [ ] **Repository links:**
  - main: https://github.com/Maya2234/capstone
  - prototype branch: https://github.com/Maya2234/capstone/tree/feature/cardstack-prototype
- [ ] **Meeting notes:**
  - `Presentation/Advisor_Feedback.md` (11/17).
  - The spec's Section 7 (Advisor Review).
  - Any team meeting notes, summarized or in a `meetings/` folder.
  - `Team_Contract.md` sets out a meeting schedule, so the notes should match it.
- [ ] **Evidence of 45 hours per member:**
  - A table with each person's total hours, taken from their notebook's total line.
  - Links to both notebooks.
  - The effort matrix.
  - Optionally, a link to the GitHub contributors or commit history. Commits run from September to November, by both of you.
- [ ] **Move the current README content here,** as a "Repository contents" subsection: the file table plus the attribution list, or a link to `ethics_statement.md`, which already has the attribution list.

---

## Step 3. Design notebook (each of you, committed)

- [ ] **Create `notebooks/tomarchio_notebook.md`** (Luke: `notebooks/brogee_notebook.md`).
- [ ] **Write one entry per week for Weeks 1–14,** each with these four parts:
  ```markdown
  ## Week 5 (Sep 28 – Oct 4)
  **Worked on:** …
  **Decisions:** …
  **Hours:** 4
  **Blockers:** …
  ```
- [ ] **Label any entry written after the fact,** for example `## Week 3 (reconstructed)`. Be honest: reconstructed and labelled is fine; unlabelled is a problem.
- [ ] **Use these to reconstruct dates and hours:**
  - The git history: `git log --author=Maya --date=short --format="%ad %s"`.
  - Canvas due dates for each assignment.
  - The Presentation and Design_Diagrams files.
  - Your calendar.
- [ ] **End with a total-hours line** (at least 45) **and a summary paragraph.**
- [ ] **Commit it, then export it to PDF for Canvas.**

## Step 4. Team and self assessment (each of you, PDF only, not committed)

- [ ] **Part A:** rate each teammate 1–5 on contribution, communication, reliability and quality of work, with **one comment that cites a specific example**. All 5s with no examples will be returned.
- [ ] **Part B:** two paragraphs. One on what worked in how you divided work and made decisions, and one on what you'd change.
- [ ] **Part C:** two or three paragraphs covering:
  - Your growth this semester.
  - One decision you're proud of. Candidates: switching to real Plaid and Supabase; encrypting bank tokens and enforcing two-factor in the database.
  - One you'd make differently.
  - The least certain part of the design. Candidates: checkout without merchant partners; reward-rate accuracy; the Plaid production cost model.
- [ ] **Keep it out of the repo.** Add `assessments/` to `.gitignore` if you draft it there.

## Step 5. Advisor assessment (each of you, PDF)
- [ ] **Get it signed by Dr. Aurisano** (started in Step 0) **and upload it separately.** It isn't part of the 15% grade, but it is required.

---

## Step 6. Final checks, tag and submit

- [ ] **Abstract:** at most 400 ASCII characters (see the command in Section 1).
- [ ] **Table of contents:** has all 10 titles, in order and spelled exactly as in the assignment.
- [ ] **Matrix:** every requirement has a design element and at least one existing test case, and every test case appears in the matrix.
- [ ] **No stale content:** no diagram or section contradicts the spec's current version, and the product name is consistent, or the rename is explained.
- [ ] **Fresh clone, every link clicked:**
  ```powershell
  git clone https://github.com/Maya2234/capstone "$env:TEMP\capstone-check"
  ```
  Then open the README on GitHub and click **every** table-of-contents link and every document link. The README uses root-relative links like `/Test_Plan.md`. Those work on GitHub, but in a PDF export they become dead links. Either export the PDF from the GitHub page, or use full `https://github.com/Maya2234/capstone/blob/main/...` URLs.
- [ ] **Commit everything and push.**
- [ ] **Tag the final commit and push the tag:**
  ```powershell
  git tag cs5001-final
  git push origin cs5001-final
  ```
- [ ] **Each of you uploads to Canvas:**
  - The repository link.
  - The README as a PDF.
  - Your notebook as a PDF.
  - Your team and self assessment as a PDF.
  - The advisor assessment as a PDF.
  - All team members' names on the submission.

---

## Quick status (as of Nov 23)

| Item | Status |
| --- | --- |
| Sections 2, 5, 6, 8 source files | ✅ Exist (need name and accuracy updates) |
| Section 3 user stories, D0–D2, requirements, spec, test plan | ✅ Exist; ⚠️ need reconciling (name, stack, missing test cases) |
| Traceability matrix | ⚠️ In the spec, not the README; refers to 17 test IDs that aren't defined |
| Section 4 timeline | ❌ Tasks exist, no dates or milestones |
| Section 7 self-assessment essays | ❌ Not in repo |
| Sections 1, 9, 10 | ❌ To write (abstract draft above) |
| Notebooks | ❌ `notebooks/` folder doesn't exist |
| Tag `cs5001-final` | ❌ Not created |
| Advisor assessment | ❌ Ask Dr. Aurisano now |
