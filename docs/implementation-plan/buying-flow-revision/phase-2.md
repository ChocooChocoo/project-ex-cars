[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** ✅ Done (2026-10-13)

# Phase 2: Schema and vehicle papers custody

**Goal:** the vehicle papers are tracked from the CI to the Sales Manager (visit flows) or to the buyer (field
flows), and Mark as Sold and Mark Dispatched are refused until custody is correct.

## Tasks

- [x] Migration `supabase/migrations/00058_t01_sale_handovers.sql` with `00058_t01_sale_handovers.test.ts`:
  - table `sale_handovers` (primary key `transaction_id`): `papers_status` (`requested`, `released_to_ci`, `handed_over`, `received`, `returned`), `papers_ci_id`, `papers_updated_at`, plus the contract and field columns used in Phase 3;
  - RLS: SELECT for the owning customer and `ceo`, `sales_manager`, `head_accountant`, `account_manager`; no write policy (service role only);
  - `field_cases`: `ci_received_at`, `mechanic_received_at` (used from Phase 4).
- [x] Migration 00058 applied to the hosted Supabase project (it was the only pending migration).
- [x] `src/lib/transactions/buy-flow.ts`: `PAPERS_STATUS_LABELS`, `isFieldArrangement`, `papersReadyForSale` (a visit needs `received`; meet-up and delivery need `handed_over`), with tests.
- [x] New `src/app/(staff)/transactions/handover-actions.ts` (+ `handover-actions.test.ts`):
  - `requestPapersRelease` (Sales Manager or CEO, GCE visit only, after the Head Accountant has verified a payment);
  - `approvePapersRelease` (CI only, sets `handed_over`); `receivePapers` (Sales Manager or CEO, sets `received`);
  - `releasePapersToCi` and `handPapersToBuyer` (only the CI assigned on the request's `delivery` or `buyer_meetup` field case);
  - every other role gets "Only the Confidential Informant handles the vehicle papers."
- [x] `closeBuyRequest` in `src/app/(staff)/transactions/actions.ts`: papers that were requested or taken out become `returned` on no-show, decline and unavailable.
- [x] `transitionTransaction`: refuses `completed` unless `papersReadyForSale`.
- [x] `advanceDeliveryStatus` in `src/app/(staff)/field-cases/delivery-actions.ts`: refuses `dispatched` before `released_to_ci`.
- [x] UI:
  - `src/app/(staff)/transactions/[id]/_components/handover-panel.tsx`: "Vehicle papers" card on an approved buy request (status, Request papers release, Receive papers);
  - `src/app/(staff)/field-cases/_components/papers-requests.tsx`: "Vehicle papers requests" card on the CI's Field Cases page, with "Approve and hand over";
  - `src/app/(staff)/field-cases/[id]/_components/papers-card.tsx`: papers card on the delivery case and on the new `buyer-meetup-case.tsx`; buttons for the assigned CI only;
  - `field-cases/[id]/page.tsx` now opens `buyer_meetup` cases; the case table links to them;
  - the buyer's request page shows the papers status as a badge.

## Dependencies

- Phase 1. Done.
- Migration 00058 on the hosted Supabase project. Done.

## Done when

- [x] Scenario 1: statuses run Papers Requested, Papers Handed Over, Papers Received; Mark as Sold before the CI approves is refused.
- [x] Scenario 3: Mark Dispatched before the CI records the release is refused; the Mechanic and Head Security cannot record papers.
- [x] A no-show or a decline records the papers back under the CI.
- [x] `npm run test` and the 00058 migration test pass.

## Verification (2026-10-13)

| Check | Result |
| --- | --- |
| `npm run test` | 59 files, 368 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on the touched files | no findings |
| `npm run build` | compiled, exit 0 |
| `npx playwright test buying-revision-phase2 --headed` (dev server on :3000, hosted Supabase) | 2 of 2 passed |
| Impeccable detector on the four new UI files | no findings |

Unit tests were written before the code they cover and seen to fail first: the papers rules (3), the
handover actions (13) and the three gates (3 refusals red, then green).

What the Playwright spec `src/tests/e2e/buying-revision-phase2.spec.ts` walks in the browser:

1. **Scenario 1, cash at a GCE visit.** After approval and a recorded cash payment: the papers request is refused until the Head Accountant verifies the payment, and Mark as Sold is refused. After verification the Sales Manager requests the papers (Papers Requested); the CI approves on Field Cases (Papers Handed Over); Mark as Sold is still refused; the Sales Manager receives them (Papers Received); the car is marked sold. The buyer's page shows Papers Received.
2. **Scenario 3, cash delivery.** Head Security and the Mechanic see the papers card with no button; Mark Dispatched is refused. The assigned CI records the release (Papers Released to CI); the car is dispatched. The buyer is unavailable: the row and the page show Papers Returned to CI.

Screenshots (desktop and 390px): `test-results/phase2-*.png`.

## Files changed

- New: `supabase/migrations/00058_t01_sale_handovers.sql`, `00058_t01_sale_handovers.test.ts`
- New: `src/app/(staff)/transactions/handover-actions.ts`, `handover-actions.test.ts`, `papers-gates.test.ts`
- New: `src/app/(staff)/transactions/[id]/_components/handover-panel.tsx`
- New: `src/app/(staff)/field-cases/_components/papers-requests.tsx`
- New: `src/app/(staff)/field-cases/[id]/_components/papers-card.tsx`, `buyer-meetup-case.tsx`
- New: `src/tests/e2e/buying-revision-phase2.spec.ts`
- Changed: `src/lib/transactions/buy-flow.ts`, `buy-flow.test.ts`
- Changed: `src/app/(staff)/transactions/actions.ts`, `[id]/page.tsx`, `[id]/_components/staff-transaction-detail.tsx`
- Changed: `src/app/(staff)/field-cases/delivery-actions.ts`, `page.tsx`, `[id]/page.tsx`, `[id]/_components/delivery-case.tsx`, `_components/field-cases-table.tsx`
- Changed: `src/app/(customer)/my-transactions/[id]/page.tsx`, `_components/transaction-detail.tsx`

## Notes and open items

- **Not walked in the browser:** the Meet Halfway path (the `buyer_meetup` case page and "Hand papers to buyer"). Its actions are covered by unit tests only. Phase 4 assigns the meet-up team automatically; until then the Sales Manager creates the Buyer meet-up case from Field Cases and picks the CI there.
- **Behaviour that got stricter:** a cash sale at a GCE visit now needs a payment verified by the Head Accountant before the papers can be requested, so before the car can be marked sold. Before, a recorded cash payment was enough.
- **Existing data:** buy requests already approved in the hosted database need the papers steps before Mark as Sold.
- **Older Playwright specs** (`t01-phase2` to `t01-phase6`, `scenario-8`, `scenario-9`) were not rerun. Any that mark a car sold or dispatch a delivery will fail on the new gates until Phase 6.
- The CI approves a visit-flow request from the Field Cases page, because field roles cannot read transactions under RLS.
- `handPapersToBuyer` does not yet check the signed contract or the cash; Phase 3 adds both.

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
