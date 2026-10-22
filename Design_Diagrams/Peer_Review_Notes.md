# CardStack — Peer Design Review Notes (D2)

Feedback from the D2 detailed-design review, converted into action items. The three issues
recorded here are the ones captured during the review and already summarised in D2 Section 6;
this file expands them with the rubric criterion, an owner, a priority and a due date, and adds
what the draft currently does about each one.

Criterion is one of **completeness**, **feasibility**, **clarity** or **risk**.
Priority is one of **must-fix**, **worth considering** or **out of scope for now**.

Owners follow the [team contract](../Team_Contract.md): Maya Tomarchio (lead developer),
Luke Brogee (coordinator and test owner).

All three items in Section 1 came from the same reviewer, Claire Hooper; the written record does not
say which team she reviewed on behalf of, so no team number is claimed here.

## 1. Items received

| ID | Criterion | Issue (raised by) | Action | Owner | Priority | Due |
| --- | --- | --- | --- | --- | --- | --- |
| PR-1 | Feasibility | Plaid connects bank and credit accounts for *reading* data, but it may not hand back a card token that can actually be charged. (Claire Hooper) | Document the token path end to end: Plaid Link → `/processor/token/create` with Stripe as the processor → `user_card.processor_token` → the charge in I4/I5. Add the same paragraph to the Design Rationale so a reader can see the card becomes chargeable without CardStack ever seeing a PAN. | Maya | must-fix | 11/10 |
| PR-2 | Clarity | The design says a declined card is followed automatically by a different card, but never states what the user is asked or told when that happens. (Claire Hooper) | Make the fallback an explicit user choice: the popup names the card being tried, shows the declined result, and offers "try <next card>" before a second charge. Update EC-03 and the PROCESSING → CARD_SELECTED edge in Figure 2 to match. | Maya | worth considering | End of semester |
| PR-3 | Clarity | Parts of the document do not agree with each other — for example the technology stack and the design rationale describe different hosting and frontend choices. (Claire Hooper) | Re-read D2 top to bottom against D1 and synthesise: one React Native story, one Azure story, interface revisions applied everywhere they are referenced. | Luke | must-fix | 10/31 |

Legend for the priority column: PR-1 was recorded as *Medium* in D2 §6 and is raised to must-fix
because requirements R-1 and R-2 cannot be credited if the card cannot be charged. PR-2 was
recorded as *Low* and stays at worth-considering: the behaviour exists, so what is missing is
the consent copy rather than the mechanism.

### What the current draft does about each one

- **PR-1 — open in the design, mocked in the draft.** Cards are stored as processor tokens plus
  last4 only ([cards.go](../server/internal/store/cards.go), `user_card.processor_token`), and the
  charge path sends that token ([payments.go](../server/internal/payments/payments.go)). But the
  Plaid abstraction in [plaid.go](../server/internal/plaid/plaid.go) has only link-token and
  public-token exchange calls — there is no processor-token step — so the demo falls back to
  `seed_tok_*` tokens. The missing paragraph is still missing from D2 itself.
- **PR-2 — mechanism done, consent copy not.** A decline walks the ranked list instead of
  failing (`TestDeclineFallsThroughToNextCard`, [api_test.go](../server/internal/api/api_test.go)),
  and the checkout popup lists every alternative with what it would have earned, plus a
  "use a different card" control ([Checkout.tsx](../apps/web/src/components/Checkout.tsx)). The
  automatic retry still happens without asking, so the action above is only partly applied.
- **PR-3 — partly done.** The draft implements one stack consistently (Go server + React/Vite web
  + React Native mobile), but D2's rationale still argues for React Native *for web* and for Azure
  hosting in both places. The written document has not been re-synthesised yet.

## 2. Notes from reviewing other teams

Not captured here. The review session produced no written record of the comments CardStack gave on
the other teams' designs, so this file does not claim any. Add them as `RV-1`, `RV-2`, … if the
notes turn up.

## 3. Carried forward from D2's own open questions (not peer feedback)

Listed so the two known gaps are not lost between reviews. Neither was raised by a reviewer.

| ID | Criterion | Issue | Action | Owner | Priority | Due |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-1 | Clarity | D2 leaves card-selection tie-breaking and the comparison between miles and cash back undecided, and mentions them only as edge cases. | State the scoring rule and the tie-break order in Section 2 and in EC-02: `effective_value = amount × rate × point_value`, ties go to the preferred card, then lowest utilization, then the oldest card. | Maya | must-fix | 11/10 (applied in draft) |
| OQ-2 | Risk | The virtual debit card (phase 2) is in concept testing with no requirement behind it. | Keep it out of D2, and say plainly in the rationale that no interface, data model or requirement is committed for it. | Luke | out of scope for now | — |

## 4. Summary

**Which criterion drew the most feedback.** Clarity — two of the three items (PR-2, PR-3), with
feasibility taking the third (PR-1) and nothing raised under completeness or risk. That split is
useful rather than disappointing: neither clarity item was about the design being wrong, they were
about a decision the system silently makes (charging the next card) and a document that had drifted
out of step with itself. The feasibility item is the one with real weight, because it questions
whether a Plaid token can be charged at all; the answer has to be written into D2, not just
implemented.

**Top two issues raised while reviewing other teams.** Not recorded in this session — see Section 2.

### Follow-up

- Update D2 Section 6 to match this file once PR-1 and PR-3 are applied, so the document and the
  committed notes do not disagree.
- Fold the PR-1 processor-token paragraph into the Design Rationale rather than leaving it in the
  review notes, where a reader grading D2 will not look for it.
