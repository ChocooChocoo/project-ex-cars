[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)

**Status:** ✅ Done (2026-10-14, not committed)

# Phase 4: Scenario flow changes (S2, S4/S5, S8, S9, chat)

**Goal:** each scenario follows the client doc's step order, including the reordered financing meet-up and
financing delivery.

## Tasks

- [x] Financing terms chain Sales Manager, Head Accountant, CEO: `src/app/(staff)/transactions/financing-actions.ts`.
- [x] Financing with a meet-up or delivery arrangement: `isFinancingRequest` in `src/lib/transactions/buy-flow.ts`, `respondToFinancingOffer` in `src/app/(customer)/my-transactions/actions.ts`.
- [x] Delivery team and field case: `createDeliveryFieldCase` in `src/app/(staff)/transactions/delivery-actions.ts`.
- [x] Migration `supabase/migrations/00059_t01_scenario_flow_fields.sql`: `payment_terms.monthly_payment`, `missed_payment_policy`, `delivery_fee`; `purchase_details.requested_term_months`, `delivery_terms_agreed_at`; `inquiries.intention_kind` += `buy_financing`. Applied to the hosted project (owner's go-ahead, 2026-10-14).
- [x] Scenario 2: after Approve, the Sales Manager must choose a CI and a Mechanic; create the `buyer_meetup` field case with the worker check from `createDeliveryFieldCase`; add `receiveFieldCase` for both.
- [x] Scenarios 4 and 5: `proposeFinancingTerms` requires `monthly_payment` and `missed_payment_policy`; fields in `financing-panel.tsx`.
- [x] Scenario 8: term picker (1, 2, 3, 5 years) with the monthly amount in the customer `transaction-detail.tsx`; no downpayment on meet-up terms; team assigned only after contract approval and booking; `completeFinancingAgreement` requires `signing_reported_at` instead of a confirmed downpayment; Mark as Sold skips the payment-record check for this case.
- [x] Scenario 9: the buyer picks the delivery date and clicks **I agree** at request; `proposeFinancingTerms` takes the delivery fee; `confirmFinancingTerms` writes the fee, the downpayment and the 3-working-day deadline and sends the breakdown (replaces `setDeliveryTerms` for financing); `completeFinancingAgreement` requires delivered plus `signing_reported_at`.
- [x] Scenario 3: delivery terms notice with **I agree** before submit.
- [x] Chat: create a `buy_financing` inquiry thread on financing submit (same pattern as the sell negotiation thread in `submitSellVehicle`); link it from the staff and customer request pages.

## Dependencies

- Phase 3. Done.
- Migration 00059 applied to the hosted Supabase project. Done.
- Migration 00060 (new, see below) applied to the hosted Supabase project. Done (owner's go-ahead, 2026-10-14).

## Done when

- [x] Scenario 2: approval without a CI or a Mechanic is refused.
- [x] Scenario 8: no Initial Downpayment field; Complete financing agreement is offered only after the CI reports the signing; the buyer page shows ₱500,000 as both Vehicle Price and Amount Financed.
- [x] Scenario 9: terms cannot be sent without the fee, the downpayment or the missed payment policy; the CEO's confirmation sends the breakdown.
- [x] The Sales Manager and the buyer can chat on a financing request.

## Decisions (owner, 2026-10-14)

- Apply 00059, then 00060, to the hosted project.
- Scenario 8's monthly amount at request is the price divided by the months, shown as an estimate ("The Sales Manager confirms the final amount."). The Sales Manager types the real monthly payment in the terms.

## What changed beyond the task list

- **Migration 00060** `supabase/migrations/00060_t01_financing_chat_access.sql` (+ test): the Sales Manager's policies covered only `buy_now` threads, so he could not open or answer a `buy_financing` thread. Three policies (read the thread, read and send its messages), copied from the Marketing Specialist's sell-thread policies. Adds only.
- `src/lib/transactions/meetup-server.ts`: the worker check, the booked meet-up and the case creation, shared by the approval (cash) and `createMeetupFieldCase` (financing).
- `createMeetupFieldCase` in `transactions/delivery-actions.ts`: a financed meet-up gets its team only after the contract is approved and the meet-up is booked.
- New `meetup-team-panel.tsx` on the staff request page; `PersonSelect` is now exported from `delivery-panel.tsx`.
- New `receive-case-button.tsx` on the buyer meet-up case, with each member's received time.
- `setDeliveryTerms`: a financed delivery may still be rejected as not serviceable, but its fee and downpayment come only from the financing terms. The delivery panel says so and offers the reject button.
- The staff inquiries list, thread page and loader let the Sales Manager see `buy_financing` threads beside `buy_now`.
- The financing panel shows the delivery fee, the monthly payment and the missed payment policy, and links to the chat.
- E2E helpers in `src/tests/e2e/support/t01.ts`: `buyerRequest` takes a term and ticks the delivery terms; `proposeTerms` fills the monthly payment and policy; `approveAsSalesManager` picks the meet-up team when shown and waits for the last verification to land.
- `buying-revision-phase3.spec.ts` Scenario 2 now gets its field case from the approval instead of a service-role insert.

## Verification (2026-10-14)

| Check | Result |
| --- | --- |
| `npm run test` | 65 files, 447 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on the 26 touched files | no findings |
| `npm run build` | exit 0 |
| `playwright test buying-revision-phase4` (dev server on :3000, hosted Supabase) | Scenarios 2 and 8 passed in one run; Scenario 9 passed on its own run (see notes) |
| Impeccable detector on the changed UI files | no findings |
| `playwright test buying-revision-phase3` rerun with the changed helpers | 3 of 3 passed |
| Rerun after Phase 5 (2026-10-14, Phase 5 in the working tree) | Scenario 2 passed. Scenario 8 failed 4 times on timeouts at different steps (no app error shown); the hosted Supabase project answered its health check in 0.2 to 7.5 s and sign-in took 11.5 s. Scenario 9 and the Phase 5 spec not run. To rerun when Supabase is fast. |
| Rerun when Supabase answered in 0.3 s (2026-10-14) | Scenario 8 passed (6.3 min), Scenario 9 passed (4.9 min). With Scenario 2 above, all three pass with Phase 5 in place. |

Unit tests were written first and seen to fail: financing actions (10 of 11), the buyer request and chat thread (6), the team, sold and receive rules (14).

What `src/tests/e2e/buying-revision-phase4.spec.ts` walks in the browser:

1. **Scenario 2.** Approve is refused with no team and with only a CI ("Choose a Confidential Informant and a Mechanic before approving."). With both, the request is approved, the field case opens, the CI and the Mechanic each click Receive Field Case, and the request shows both received.
2. **Scenario 8.** The buyer picks a 3-year term. The terms form has no Initial Downpayment field and stays disabled until the missed payment policy is filled. The Sales Manager opens the chat from the request and sends a message; the buyer reads it from "Chat with GCE" and replies. Head Accountant and CEO approve. The buyer sees "No downpayment." and books the meet-up. The team button stays disabled until the contract is approved, then sends the command. The CI receives the case, releases the papers and records Buyer Met; Complete financing agreement is not offered yet. The buyer signs in the app, the CI reports the signing, keeps a copy and hands over the papers; the Head Accountant opens the account (financed ₱500,000, downpayment ₱0, checked in the database); the car is sold. The buyer page shows Vehicle Price ₱500,000 and Amount Financed ₱500,000.
3. **Scenario 9.** The buyer books the delivery date and agrees to the delivery terms at request. Send stays disabled without the delivery fee. After the CEO confirms, the buyer's notification carries the fee ₱2,500, downpayment ₱100,000, ₱102,500 to pay now, ₱400,000 financed and ₱33,334 a month, and the buyer page shows the fee and downpayment with no "Accept and book" step. The fee and downpayment are recorded and verified, the delivery runs to Delivered, Complete financing agreement is still not offered, the CI reports the signing and hands over the papers, the account opens and the car is sold.

Screenshots: `test-results/phase4-*.png` (desktop and 390px).

## Files changed

- New: `supabase/migrations/00059_t01_scenario_flow_fields.sql`, `.test.ts`; `00060_t01_financing_chat_access.sql`, `.test.ts`
- New: `src/lib/transactions/meetup-server.ts`
- New: `src/app/(staff)/transactions/financing-actions.test.ts`, `meetup-team.test.ts`, `[id]/_components/meetup-team-panel.tsx`
- New: `src/app/(staff)/field-cases/[id]/_components/receive-case-button.tsx`
- New: `src/app/(customer)/my-transactions/buy-request-phase4.test.ts`
- New: `src/tests/e2e/buying-revision-phase4.spec.ts`
- Changed: `src/app/(staff)/transactions/financing-actions.ts`, `delivery-actions.ts`, `actions.ts`
- Changed: `src/app/(staff)/transactions/[id]/page.tsx`, `_components/staff-transaction-detail.tsx`, `financing-panel.tsx`, `delivery-panel.tsx`
- Changed: `src/app/(staff)/field-cases/delivery-actions.ts`, `[id]/_components/buyer-meetup-case.tsx`
- Changed: `src/app/(staff)/inquiries/actions.ts`, `page.tsx`, `[id]/page.tsx`
- Changed: `src/app/(customer)/my-transactions/actions.ts`, `_components/transaction-detail.tsx`
- Changed: `src/lib/validation/transactions.ts`
- Changed: `src/tests/e2e/support/t01.ts`, `buying-revision-phase3.spec.ts`

## Assumptions

- A financed meet-up's terms store a downpayment of 0; the field is hidden.
- The payment term picker is required only for a financed meet-up (Scenario 8 is the only scenario that asks for it at request).
- The delivery terms notice is a checkbox labelled with the notice and "I agree", like the condition acknowledgement.
- A financed delivery skips the buyer's "Accept and book" step: the CEO's confirmation holds the car (`purchase_claim`) and starts the 3-working-day deadline, as Scenario 9 step 5 describes.
- Receive Field Case is on the meet-up case only. Scenario 9's delivery has no receive step.
- The buyer's notices still say "by bank transfer"; PayMongo is Phase 5.

## Notes and open items

- **Test runs and the hosted project:** the full spec signs in about 60 times; twice in a row Supabase auth refused a sign-in late in the run (`POST /auth/v1/login 200`), and once the dev server slowed to 16 to 20 s per request. Scenario 9 then passed on a fresh dev server. These were environment limits, not app failures.
- **Chat updates live only over realtime.** A sent message appears in the open thread through the realtime subscription; in the test it was checked after a reload. This is how every thread already works.
- **Not walked in the browser:** the refusal when the delivery terms box is not ticked, and the refusal when the downpayment is missing on a financed delivery. Both are unit-tested.
- **Layout:** on the staff request page the Meet-up team card sits below the documents column, under the Approve button's card. The refusal toast names what is missing.
- **Older Playwright specs** (`t01-phase2` to `t01-phase6`, `scenario-8`, `scenario-9`) were not rerun. `scenario-8` and `scenario-9` follow the old order and will fail until Phase 6 rewrites them.
- The test runs left completed test requests in the hosted database, as in earlier phases; the test cars are archived.

[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)
