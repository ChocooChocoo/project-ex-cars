[Next: Phase 2 →](./phase-2.md)

**Status:** ✅ Done (2026-10-13, not committed)

# Phase 1: Schedule rules and image resubmission

**Goal:** every booking obeys "on the hour, 9 AM to 9 PM, Monday to Saturday", deliveries need 7 days' lead,
and the Sales Manager can ask for an image to be resubmitted with a reason.

Source: `docs/DOCUMENTS/@GCE Vehicle Marketplace.md`, "Rules that apply to every scenario".

## Tasks

- [x] On-the-hour rule for GCE visits: `isVisitSlot` in `src/lib/transactions/buy-flow.ts`.
- [x] Document image preview: `src/components/transaction-image-preview.tsx`, used in `src/app/(staff)/transactions/[id]/_components/transaction-detail-sidebar-v1.tsx`.
- [x] Reject a document and free the slot for a replacement: `verifyTransactionDocument` in `src/app/(staff)/transactions/actions.ts`, `activeBuyerIdCount` in `buy-flow.ts`.
- [x] Approval blocked until 2 IDs and proof of billing are verified: `transitionTransaction` in `src/app/(staff)/transactions/actions.ts`.
- [x] Add `isBusinessSlot(date)` to `buy-flow.ts`: on the hour, 9 AM to 9 PM start, Monday to Saturday, evaluated in `Asia/Manila`. `isVisitSlot` calls it.
- [x] Add `DELIVERY_LEAD_DAYS = 7` and `isDeliveryDate(schedule, requestDate)` to `buy-flow.ts`.
- [x] Add cases for both to `src/lib/transactions/buy-flow.test.ts` (10:30, 8 AM, 10 PM, Sunday, 9 PM, 6 days, 7 days).
- [x] Apply `isBusinessSlot` to meet-up and delivery in `saveBuyDetails`, `submitBuyRequest`, `respondToFinancingOffer` (`src/app/(customer)/my-transactions/actions.ts`) and `rescheduleDelivery` (`src/app/(staff)/transactions/delivery-actions.ts`).
- [x] Apply the 7-day lead in `saveBuyDetails` and `rescheduleDelivery`. Uses the doc's error text.
- [x] A GCE visit at 10:30 is refused, not rounded to 10:00 (owner's decision, 2026-10-13): `pickedTime` in `buy-flow.ts` no longer drops the minutes.
- [x] Migration `supabase/migrations/00057_t01_document_rejection_reason.sql`: `transaction_documents.rejection_reason TEXT`.
- [x] Migration 00057 applied to the hosted Supabase project (`npx supabase db push --include-all`; it was the only pending migration).
- [x] `verifyTransactionDocument`: accepts `reason` on `rejected`, stores it, notifies the buyer with it (`document_resubmission_requested`).
- [x] `transaction-detail-sidebar-v1.tsx`: Reject became "Ask to resubmit" with a labelled "What to fix" field; the button is disabled until a reason is typed. Sell papers use the same list, so they get the same control.
- [x] `TransactionImagePreview`: every image is a button that opens a larger view in the shadcn `Dialog` (focus ring, closes with Escape).
- [x] Customer `src/app/(customer)/my-transactions/_components/transaction-detail.tsx`: shows "Please upload a new one. What to fix: ..." beside a rejected document, and states the slot rule under both date pickers.

## Dependencies

None.

## Done when

- [x] `npm run test` passes with the new slot and lead cases.
- [x] 10:30, 8:00 AM, 10:00 PM and a Sunday are refused for visit, meet-up, delivery and reschedule.
- [x] A delivery sooner than 7 days shows "Delivery must be scheduled at least 7 days after your request date."
- [x] The Sales Manager asks for a resubmission with a reason; the buyer is notified and uploads again; approval stays blocked until the new image is confirmed.

## Verification (2026-10-13)

| Check | Result |
| --- | --- |
| `npm run test` | 56 files, 343 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on the touched folders | no findings |
| `npm run build` | compiled, 96 static pages, exit 0 |
| `npx playwright test buying-revision-phase1` (dev server on :3000, hosted Supabase) | 3 of 3 passed |
| Impeccable detector on the three changed UI files | no findings |
| Contrast of the new text (default preset) | rejected note 4.76:1 light, 6.19:1 dark; hint text 4.73:1 light, 6.91:1 dark |

The seven new unit tests were checked against deliberately broken code (rule removed, reason dropped, button
always enabled, dialog hidden): all seven failed, then passed again with the code restored.

What the Playwright spec `src/tests/e2e/buying-revision-phase1.spec.ts` walks in the browser:

1. Buyer: GCE Visit, CALABARZON Meet-up and Delivery each refuse 10:30, 8:00 AM, 10:00 PM and a Sunday with the slot message; a delivery under 7 days shows the lead message; Tuesday 9:00 PM saves.
2. Sales Manager opens an ID image in the larger view and closes it with Escape; "Ask to resubmit" is disabled without a reason; with a reason the buyer gets a notification containing it; Approve is refused. The buyer sees the reason and uploads a new image; the Sales Manager confirms it and Approve works.
3. Sales Manager: rescheduling a delivery to a Sunday or to under 7 days after the request is refused.

Screenshots (desktop and 390px): `test-results/phase1-*.png`.

## Files changed

- `src/lib/transactions/buy-flow.ts`, `buy-flow.test.ts`
- `src/app/(customer)/my-transactions/actions.ts`, `actions.test.ts`
- `src/app/(customer)/my-transactions/_components/transaction-detail.tsx`, `transaction-detail.test.tsx`
- `src/app/(staff)/transactions/actions.ts`, `actions.task33.test.ts`, `delivery-actions.ts`
- `src/app/(staff)/transactions/[id]/_components/staff-transaction-detail.tsx`, `transaction-detail-sidebar-v1.tsx`, `transaction-detail-sidebar-v1.test.tsx`
- `src/components/transaction-image-preview.tsx`
- `supabase/migrations/00057_t01_document_rejection_reason.sql` (new)
- `src/tests/e2e/buying-revision-phase1.spec.ts` (new), `src/tests/e2e/support/t01.ts` (`futureSlot` skips Sundays)

## Notes and open items

- The older Playwright specs (`t01-phase2` to `t01-phase6`, `scenario-8`, `scenario-9`) were **not rerun**. Any that click a document's "Reject" button, expect "Pick a future GCE visit slot on the hour." on the first booking, or rely on 10:25 being rounded will fail until Phase 6 updates them.
- The e2e fixture image is a 1x1 pixel, so the larger view was checked for opening, focus and closing, not for how a real photo fills it.
- Contrast was computed for the default theme preset only.
- `npm run check:fix` (and `biome check --write` on a folder) reformats files unrelated to this work. Lint only the files you touched.

## Assumptions (apply to all phases; the client doc as written)

- The "Final price" notice stays unchanged.
- Scenario 8: the buyer and the CI keep the signed copies; the Mechanic has no papers role.
- Scenario 8: papers go to the buyer at the meet-up, before the financing account opens.
- Scenario 9: the contract is signed on delivery day with no Head Accountant pre-approval.
- The Head Accountant reviews financing terms before the CEO.
- 9 PM is the last start time. Signing in the app is a typed name plus a timestamp.
- Selling: papers are with the CI by default; no new sell-side state.
- Bank transfer (Scenarios 6 and 7) follows the cash rules.
- PayMongo is a payment link plus manual Head Accountant verification.

[Next: Phase 2 →](./phase-2.md)
