[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)

**Status:** ✅ Done except `npm run check` (2026-10-14, not committed). Every buying spec passes; Scenarios 1 and 9 walked in the Playwright MCP browser.

# Phase 6: End-to-end verification

**Goal:** every scenario in the client doc, including its "Also try" refusals, passes in Playwright.

## Tasks

- [x] Scenario specs exist to extend: `src/tests/e2e/scenario-8-financing-meetup.spec.ts`, `scenario-9-financing-delivery.spec.ts`, the `t01-phase2` to `t01-phase6` specs, helpers in `src/tests/e2e/support/t01.ts`.
- [x] Extend `support/t01.ts` with helpers for papers, contract, team assignment and Pay: `markSold`, `recordPayment`, `fieldCasePath`, `writeAndApproveContract`, `buyerSignsContract`, `verifyPayments`, `papersThenSold`, `ciClosesFieldCase`. The Phase 4 spec now imports them instead of keeping its own copies. Pay stays in `buying-revision-phase5.spec.ts`.
- [x] Update `t01-phase2-onsite-visit`, `t01-phase3-halfway-queue`, `t01-phase4-delivery`, `t01-phase5-financing`, `t01-phase6-bank-transfer` and the branch specs to the new steps (see "What changed").
- [x] Rewrite `scenario-8` (no downpayment) and `scenario-9` (reordered) to the doc: the doc-ordered walks are Scenarios 8 and 9 in `buying-revision-phase4.spec.ts`, so the old-order files were removed (see Assumptions).
- [x] Add the "Also try" refusals per scenario: schedule, resubmission, papers, contract, role refusals. Coverage table below; three were added in this phase.
- [x] Run `npm run test`, then `npm run dev` and the e2e specs. `npm run check:fix` was **not** run: it would rewrite unrelated files (see Notes).
- [x] Walk Scenario 1 and Scenario 9 by hand with the seeded `@gce.local` accounts: walked step by step in the Playwright MCP browser (see "Playwright MCP walk"). One bug found and fixed; four wording or display mismatches listed for the owner.

## Dependencies

- Phases 1 to 5. Done and committed (Phase 4 `c11e046`, Phase 5 `3727fef`).

## Done when

- [ ] `npm run check` reports no errors. Not met: 33 errors, all in files this work never touched (`.opencode/`, `scripts/`, `package.json` formatting, and older `src/` files with line-ending and import-order findings). `npx biome check` on every file changed here is clean.
- [x] `npm run test` passes: 67 files, 456 tests.
- [x] The e2e specs pass for all seven doc scenarios plus bank transfer (table below).

## What changed

- `t01-phase2-onsite-visit`: the cash payment is checked by the Head Accountant and the papers go Requested, Handed Over, Received before Mark as Sold. Added: Approve before the three documents are confirmed is refused (Scenario 1).
- `t01-phase3-halfway-queue`: rewritten on the shared helpers. The fixed 2031-06-15 meet-up was a Sunday; it now uses `futureSlot()`. The promoted request is approved with its CI and Mechanic, the CI records papers, Buyer Met, the paper signing, both copies and the cash, then the payment is recorded, checked, and the car is sold.
- `t01-phase4-delivery`: the buyer ticks the delivery terms notice; the CI records the papers before dispatch. Added: Mark as Sold before Delivered is refused (Scenario 3).
- `t01-phase4-branches`: the CI records the papers before dispatch.
- `t01-phase5-financing`: terms carry the monthly payment and missed payment policy; the visit field is "GCE visit date and time" and the date comes from `futureSlot()` (the random date could fall on a Sunday); the contract is approved and signed before the downpayment; papers before the sale; checks wait on the action toasts. Added: a 10:25 visit is refused with "Pick a future GCE visit slot on the hour." (Scenario 4).
- `t01-phase5-branches`: the claim helper writes, approves and signs the contract before the downpayment and runs the papers chain before the sale. The owner's earlier `test.slow()` lines are kept.
- `t01-phase6-bank-transfer`: the visit is on the hour (10:25 is refused since Phase 1) and the papers go through the CI before the sale.
- `t01-phase2-3-branches`, `t01-phase3-halfway-queue`: `test.slow()` where a test signs in many times.
- Removed: `scenario-8-financing-meetup.spec.ts`, `scenario-9-financing-delivery.spec.ts`, `t01-phase6-financing-arrangements.spec.ts`.

## Verification (2026-10-14, dev server on :3000, hosted Supabase)

| Spec | Scenario | Result |
| --- | --- | --- |
| `buying-revision-phase1` | Rules for all (hours, resubmission, reschedule) | passed in Phase 1; not changed |
| `buying-revision-phase2` | 1 (papers), 3 (dispatch) | passed in Phase 2; not changed |
| `buying-revision-phase3` | 4, 2, 3 (contract) | passed in Phase 4's rerun; not changed |
| `buying-revision-phase4` | 2, 8, 9 | 3 of 3 passed after the helper move (18.6 min) |
| `buying-revision-phase5` | 3, 5 (Pay) | 2 of 2 passed (2026-10-14) |
| `t01-phase2-onsite-visit` | 1 | 4 of 4 passed |
| `t01-phase2-3-branches` | 1, 2 branches | 6 of 6 passed |
| `t01-phase3-halfway-queue` | 2 | 3 of 3 passed |
| `t01-phase4-delivery` | 3 | 6 of 6 passed (second run; the first lost a Verify click to a 20 s server response) |
| `t01-phase4-branches` | 3 branches | 3 of 3 passed |
| `t01-phase5-financing` | 4 | 7 of 7 passed |
| `t01-phase5-branches` | 4 branches | 3 of 3 passed |
| `t01-phase6-bank-transfer` | 6, 7 | 3 of 3 passed |
| `npm run test` | unit | 67 files, 456 tests passed |
| `npx tsc --noEmit` | | exit 0 |
| `npx biome check` on the changed specs and helpers | | no findings |

Scenarios 6 and 7 (bank transfer) have no section in the client doc; they follow the cash rules (Phase 1 decision).

## "Also try" coverage

| Doc item | Where |
| --- | --- |
| Slot already taken; off-hour or Sunday times (S1, S2, S3, S9) | `t01-phase2-onsite-visit`, `buying-revision-phase1` |
| Ask for an image resubmission (S1–S5, S9) | `buying-revision-phase1` |
| Approve before all three documents are confirmed (S1) | `t01-phase2-onsite-visit` (new) |
| Reject frees the slot (S1); Buyer Declined (S1) | `t01-phase2-3-branches` |
| Mark as Sold before the papers (S1, S4, S5) | `buying-revision-phase2` |
| Make Active after a reject (S2) | `t01-phase3-halfway-queue` |
| Cancel under 5 hours; no-show; second no-show; Not Legit (S2) | `t01-phase2-3-branches` |
| Approve without a CI and Mechanic (S2) | `buying-revision-phase4` |
| One signed copy only; Mark as Sold before both copies (S2) | `buying-revision-phase3` |
| Papers before signing or cash (S2, S3) | `buying-revision-phase3` |
| Mechanic or Head Security records papers; dispatch before papers (S3, S9) | `buying-revision-phase2` |
| Not serviceable; missed downpayment deadline; delay; buyer unavailable (S3) | `t01-phase4-branches` |
| Reschedule under 7 days or on a Sunday (S3, S9) | `buying-revision-phase1` |
| Declined, Legit refund (S3) | `t01-phase4-delivery` |
| Mark as Sold before Delivered (S3) | `t01-phase4-delivery` (new) |
| Terms missing the policy, fee or downpayment (S4, S8, S9) | `buying-revision-phase4` |
| Head Accountant or CEO returns the terms; Don't proceed (S4) | `t01-phase5-branches` |
| 10:25 visit refused (S4, S5) | `t01-phase5-financing` (new) |
| Contract returned; signing an unapproved contract; payment before signing (S4) | `buying-revision-phase3` |
| Needs time: Potential Buyer (S4) | `t01-phase5-branches` |
| Pay before signing; Mark as Sold before the PayMongo payment is verified (S5) | `buying-revision-phase5` |
| Team before contract approval; Complete financing before the signing report (S8, S9) | `buying-revision-phase4` |

Not covered in the browser, with the reason:

- **"Mark the amount as wrong" (S1, S2, S3, S9):** the app has no reject action for a payment. A feature, not a test; listed for a later phase.
- **"A location outside Calabarzon should be refused" (S8):** the app does not check the meet-up location. Same.
- **"Leave a request for 7 days: Delayed, Needs Action" (S1), "Do not pay within 3 working days" (S9):** time-based; S3's missed deadline is walked in `t01-phase4-branches`, the rest are unit-tested.
- **"Do not click I agree" (S3, S9), "CI reports the signing before Buyer Met" (S8), "Mechanic hands over the papers" (S2, S3, S9):** the UI hides the button or field; the server refusals are unit-tested (`buy-request-phase4.test.ts`, `handover-actions.test.ts`).
- **Monthly payments over months (S4, S5, S8, S9 last step):** `t01-phase5-branches` pays an installment and walks four missed months to repossession.

## Playwright MCP walk (2026-10-14)

Scenarios 1 and 9 walked step by step in the Playwright MCP browser (no spec, no CLI), each role signed in
in turn, against the dev server and hosted Supabase. Test cars: "GCE Test Artifact S6c" (S1, request
`f9f44faa`) and "GCE Test Artifact S9" (S9, request `ea22bcfb`). Screenshots: `test-results/phase6-mcp-*.png`.

| Scenario, step | Doc expects | Seen |
| --- | --- | --- |
| S1.1 buyer | 10:30 refused; on-the-hour slot; "Request sent." | Pass. 10:30 refused with the doc's message; request Under Review |
| S1.2 Sales Manager | Images open larger; approve before confirming refused; Approve | Pass |
| S1.3–4 | Record Cash Received; Mark as Sold before papers refused | Pass (refused; car stays Approved) |
| S1.5 Head Accountant | Approve the payment | Pass ("Payment verified.") |
| S1.6 papers | Requested, Handed Over, Received | Pass |
| S1.7 Mark as Sold | Sold | Pass ("Transaction moved to completed.") |
| S9.1 buyer | <7 days refused; delivery notice text; I agree; "Request sent." | Pass. Notice text matches the doc word for word |
| S9.2 Sales Manager | Approve; chat with the buyer | Pass. Message stored (see mismatch 4) |
| S9.3 terms | Not sent without the delivery fee | Pass (Send disabled), then "Terms sent to the Head Accountant." |
| S9.4–5 | "Terms sent to the CEO."; "Financing confirmed; the buyer is notified."; breakdown | Pass. Notification: fee ₱2,500, downpayment ₱100,000, ₱102,500 now, financed ₱400,000, ₱33,334 × 12, delivery date |
| S9.6 Pay | Pay, sent and waiting | Pass. Placeholder link opened; both rows "Sent, waiting for the Head Accountant" |
| S9.7 Head Accountant | Rows labelled Delivery Fee and Downpayment; approve | Pass; Complete financing not offered yet |
| S9.8 team | Field case; Mark Dispatched before papers refused; CI records papers | Pass. Head Security has no papers button |
| S9.9 tracking | Dispatched → Delivered | Pass |
| S9.11 contract | Hand papers before signing refused; Buyer Met, signing, copy, papers | Pass |
| S9.12–13 | "Financing account opened."; Mark Sold; buyer sees In-House Financing — Active, ₱500,000 and ₱400,000 | Pass |

No console errors on any app page (the only error was the placeholder link's 404).

Mismatches found:

1. **Fixed:** a financed delivery's field case said "Collect nothing on delivery" and also "Balance to collect: ₱400,000.00". The line now reads "Amount financed" for financing (`field-cases/[id]/_components/delivery-case.tsx`); re-checked in the browser.
2. GCE Visit still shows a Location field; the doc (S1.1) says none should show. Not changed.
3. Wording differs from the doc: status "Under Review" (doc: "Waiting for Sales Manager Review"), button "Verify" (doc: "Check and Confirm"), payment row "Pending" (doc: "Cash Received, Waiting for Accountant Check"), payment kind "Full payment" (doc: "Paid in Full"), "Vehicle price" (doc: "Vehicle total price"). The approved request's help text still says "record the payment and mark the car sold" without the papers step. Not changed.
4. The sender's own chat message appears only after a reload (realtime only); stored correctly.
5. The financed delivery's request page shows the fee and downpayment but not the amount financed or monthly payment; those are in the notification.

## Assumptions

- `scenario-8` and `scenario-9` and `t01-phase6-financing-arrangements` walked the old order (downpayment at the meet-up, Sales Manager delivery terms after the CEO). Rewriting them would copy Scenarios 8 and 9 of `buying-revision-phase4.spec.ts` line for line, so they were removed; that spec is the doc-ordered walk. Restore from git if a separate file per scenario is wanted.
- "Walk by hand" is the owner's acceptance step; the browser specs do not replace it.

## Notes

- **`check:fix` not run.** The repo-wide check fails on files outside this work; `check:fix` would rewrite them (the Phase 1 and Phase 5 note). Run it on purpose in a separate commit if wanted.
- **Slow hosted project.** Some runs lost a click to 20 s server responses (Verify, sign-in); each such test passed on its own rerun. A full run of every buying spec takes about 90 minutes.
- Test requests stay in the hosted database; test cars are archived.

[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)
