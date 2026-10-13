[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** 🔲 Not Started

# Phase 2: Schema and vehicle papers custody

**Goal:** the vehicle papers are tracked from the CI to the Sales Manager (visit flows) or to the buyer (field
flows), and Mark as Sold and Mark Dispatched are refused until custody is correct.

## Tasks

- [ ] Migration `supabase/migrations/00058_t01_sale_handovers.sql` with a `.test.ts` in the style of `00054_t01_phase5_financing.test.ts`:
  - table `sale_handovers` (primary key `transaction_id`): `papers_status` (`requested`, `released_to_ci`, `handed_over`, `received`, `returned`), `papers_ci_id`, `papers_updated_at`, plus the contract and field columns used in Phase 3 (`contract_body`, `contract_state`, `contract_returned_reason`, `contract_written_by`, `contract_approved_by`, `contract_signed_at`, `ci_copy_at`, `mechanic_copy_at`, `signing_reported_at`, `buyer_met_at`, `cash_reported_at`);
  - RLS: SELECT for the owning customer and the buy-flow staff roles; no write policy (service role only, as `reconditioning_jobs`). Custody must not live on `purchase_details`, which customers can update;
  - `field_cases`: `ci_received_at`, `mechanic_received_at`.
- [ ] `src/lib/transactions/buy-flow.ts`: `papersReadyForSale(details, handover)` (a visit needs `received`; meet-up and delivery need `handed_over`), with tests.
- [ ] New `src/app/(staff)/transactions/handover-actions.ts`:
  - `requestPapersRelease` (Sales Manager, after the payment is verified);
  - `approvePapersRelease` (CI, sets `handed_over`); `receivePapers` (Sales Manager, sets `received`);
  - `releasePapersToCi` (assigned CI only, following `assignedDelivery` in `src/app/(staff)/field-cases/delivery-actions.ts`);
  - `handPapersToBuyer` (assigned CI only; contract and cash checks are added in Phase 3);
  - the Mechanic and Head Security are refused by role in every papers action.
- [ ] `closeBuyRequest` in `src/app/(staff)/transactions/actions.ts`: set `papers_status = 'returned'` on no-show, decline and unavailable.
- [ ] `transitionTransaction`: refuse `completed` unless `papersReadyForSale`.
- [ ] `advanceDeliveryStatus` in `src/app/(staff)/field-cases/delivery-actions.ts`: refuse `dispatched` before `released_to_ci`.
- [ ] UI: new `handover-panel.tsx` in `src/app/(staff)/transactions/[id]/_components/` (papers status and buttons); papers buttons in `src/app/(staff)/field-cases/[id]/_components/delivery-case.tsx` and a matching block for `buyer_meetup` cases; labels in `src/lib/transactions/labels.ts`.

## Dependencies

- Phase 1.
- Migration 00058 applied to the hosted Supabase project (needs the owner's confirmation).

## Done when

- [ ] Scenario 1: statuses run Papers Requested, Papers Handed Over, Papers Received; Mark as Sold before the CI approves is refused.
- [ ] Scenario 3: Mark Dispatched before the CI records the release is refused; the Mechanic and Head Security cannot record papers.
- [ ] A no-show or a decline records the papers back under the CI.
- [ ] `npm run test` and the 00058 migration test pass.

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
