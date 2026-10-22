# CardStack — Peer Design Review Notes (D2)

## Peer Feedback

| ID | Criterion | Issue (raised by) | Action | Owner | Priority | Due |
| --- | --- | --- | --- | --- | --- | --- |
| PR-1 | Feasibility | Plaid connects bank and credit accounts for *reading* data, but it may not hand back a card token that can actually be charged. (Claire Hooper) | Document the token path end to end: Plaid Link → `/processor/token/create` with Stripe as the processor → `user_card.processor_token` → the charge in I4/I5. Add the same paragraph to the Design Rationale so a reader can see the card becomes chargeable without CardStack ever seeing a PAN. | Maya | High | 11/10 |
| PR-2 | Clarity | The design says a declined card is followed automatically by a different card, but never states what the user is asked or told when that happens. (Claire Hooper) | Make the fallback an explicit user choice: the popup names the card being tried, shows the declined result, and offers "try <next card>" before a second charge. Update EC-03 and the PROCESSING → CARD_SELECTED edge in Figure 2 to match. | Maya | Medium | End of semester |
| PR-3 | Clarity | Parts of the document do not agree with each other — for example the technology stack and the design rationale describe different hosting and frontend choices. (Claire Hooper) | Re-read D2 top to bottom against D1 and synthesise: one React Native story, one Azure story, interface revisions applied everywhere they are referenced. | Luke | High | 10/31 |

## Self Critique

| ID | Criterion | Issue | Action | Owner | Priority | Due |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-1 | Clarity | D2 leaves card-selection tie-breaking and the comparison between miles and cash back undecided, and mentions them only as edge cases. | State the scoring rule and the tie-break order in Section 2 and in EC-02: `effective_value = amount × rate × point_value`, ties go to the preferred card, then lowest utilization, then the oldest card. | Maya | High | 11/10 (applied in draft) |
| OQ-2 | Risk | The virtual debit card (phase 2) is in concept testing with no requirement behind it. | Keep it out of D2, and say plainly in the rationale that no interface, data model or requirement is committed for it. | NA | NA | — |

## Summary

Clarity aspects had the most issues raised: two of the three items (PR-2, PR-3), with
feasibility taking the third (PR-1) and nothing raised under completeness or risk. That split is
useful rather than disappointing: neither clarity item was about the design being wrong, they were
about a decision the system silently makes (charging the next card) and a document that had drifted
out of step with itself. The feasibility item is the one with real weight, because it questions
whether a Plaid token can be charged at all; the answer has to be written into D2, not just
implemented.
### Follow-up

- Update D2 Section 6 to match this file once PR-1 and PR-3 are applied, so the document and the
  committed notes do not disagree.
- Fold the PR-1 processor-token paragraph into the Design Rationale rather than leaving it in the
  review notes, where a reader grading D2 will not look for it.
