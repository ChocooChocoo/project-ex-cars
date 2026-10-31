[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)

**Status:** 🟡 In progress — code complete and migration applied; SM-side browser check outstanding (2026-10-31).
deferred to the integrator (subagent verification budget).

# Phase 4: Record Payment automation and Head Accountant cleanup

**Goal:** Record Payment fills in its data for CASH buys (GCE Visit, Halfway, Delivery) and accepts one submission
per payment. The Head Accountant loses Mark Sold and Record Payment, and the Verify/Reject buttons on payment rows
look like buttons.

Source: `docs/tasks/T05.md` (Record Payment; Head Accountant).

Today: the only Record Payment form is in `transactions/[id]/_components/transaction-detail-sidebar-v1.tsx:298-387`.
The amount is typed by hand, and nothing stops a double submit: no unique constraint, no pending state.

Decisions (2026-10-29):
- With the Head Accountant's form removed, the Sales Manager records the payment. The Head Accountant still
  verifies it.
- The button to restyle is Verify/Reject on payment rows.

## Dependencies

- None. Best done after Phase 3, which touches the same triage and sidebar files.

## Tasks

- [x] Pre-check: query the hosted DB for duplicate `payment_records` rows (same `transaction_id` + `payment_kind`,
  `rejected_at is null`, `installment_id is null`). Clean any duplicates with the user's approval before the
  migration runs.
  - Done 2026-10-31 outside this worktree: six duplicate groups were found, the user approved a soft-reject
    cleanup and it was applied. 0 duplicate groups remain, so the migration carries no data change.
- [x] Migration `supabase/migrations/20261101100000_t05_payment_once.sql` (+ `.test.ts`): partial unique index on
  `payment_records(transaction_id, payment_kind)` where `installment_id is null and rejected_at is null and
  payment_kind <> 'reschedule_fee'`.
  - Written, **not applied**: the integrator runs it. The test (4 cases) pins the index name, the columns and the
    whole predicate, and asserts the file changes no rows.
- [x] `src/lib/transactions/buy-flow.ts`: add `nextDuePayment(purchaseDetails, payments, flowStatus)`, which returns
  `{ kind, amount, method } | null` for the 3 CASH arrangements. Build it on `paidTowardPrice`,
  `paymentAllowedBeforeSigning` and `onlinePaymentsDue`. Write the unit tests per arrangement first.
  - A GCE visit and a cash meet-up owe `full`; a delivery owes `delivery_fee` → `downpayment` → `balance`
    (fee skipped when free). A bank transfer (PayMongo) and a financing buy return `null`. 10 tests added to
    `buy-flow.test.ts`.
- [x] `recordPayment` (`src/app/(staff)/transactions/actions.ts:556-650`): for a CASH buy, ignore the client's
  amount and kind and use `nextDuePayment`. Map the unique violation `23505` to "This payment is already recorded."
  Allow `head_accountant` only for `installment_id` rows, so the financing "Record paid" button stays.
  - The method is taken from `nextDuePayment` too, so the insert is fully server-computed. `paymentKind` now drives
    the downpayment flow-status update and the audit summary.
- [x] `transaction-detail-sidebar-v1.tsx:298-387`:
  - Pass `purchaseDetails` and `paymentTerms` in from `staff-transaction-detail.tsx`.
  - Show the form only to `sales_manager`.
  - Make amount, payment kind and method read-only from `nextDuePayment`. The proof photo stays.
  - Disable the button while the submit is pending (`useTransition`).
  - Once the payment is recorded, replace the form with "Recorded, waiting for the Head Accountant's check."
  - `flowStatus` comes in with them; `onRecordPayment` resolves `true` on success so the note is only shown then.
    A ref guard stops a double click that lands before the disabled render. A payment already waiting for the
    check also shows the note instead of the form. The bank-transfer PayMongo note is kept.
  - Assumption: the form now appears only for a cash buy with something due. A `request_a_car` transaction no
    longer shows it either, since it has no payment kind to prefill.
- [x] Remove `head_accountant` from approved → completed (`src/lib/transactions/state-machine.ts:100-101`), so Mark
  Sold leaves the Head Accountant's triage.
  - `approved.completed` is now `SC`. The triage's empty state no longer calls an approved sale "terminal": it says
    another role takes the next step.
- [x] `transactions/[id]/_components/transaction-payments-table-v1.tsx:137-158`: change Verify/Reject from ghost
  `h-6 px-2 text-xs` to `size="sm"` buttons (Verify default, Reject outline or destructive).
  - Verify is the default `size="sm"` button; Reject is `variant="outline"` `size="sm"` with destructive text.
- [x] Update the existing tests that expect the Head Accountant to Mark Sold or record a payment.
  - `state-machine.test.ts`, `transaction-status-triage-v1.test.tsx`, `transaction-detail-sidebar-v1.test.tsx`,
    `transaction-payments-table-v1.test.tsx` and `papers-gates.test.ts` updated; the new
    `record-payment.test.ts` covers the server rules.


Integration verification (2026-10-31)

- Merged into `batch3/integration` as `4718d65`.
- Pre-check and cleanup executed earlier in the batch: 6 duplicate live payment groups were soft-rejected
  with user approval (4 plain rejects; 2 verified rows had `verified_by` cleared and the original verifier
  recorded in the reason, because `payment_records_verified_or_rejected` forbids both stamps). 0 groups
  remain, so `20261101100000_t05_payment_once.sql` applied cleanly; index
  `idx_payment_records_once_per_kind` is live with the exact partial predicate from the plan.
- Browser (Playwright MCP) as the Head Accountant: on `e5499f32-…` there is no Mark Sold action (only the
  step description text remains) and no Record Payment form. On `893c0464-…` the Verify and Reject buttons
  are real `size="sm"` controls (28 px): Verify solid primary, Reject outline with destructive text.
- Still to verify in a browser: the Sales Manager's prefilled form, the double-submit guard and the
  "Recorded, waiting for the Head Accountant's check" state. That needs a cash buy with a payment actually
  due; every candidate found was waiting on signing or on a booked slot. Unit tests cover the prefill,
  the 23505 mapping and the pending state.

## Done when

- [x] The `nextDuePayment` tests pass, and a test shows that a second payment of the same kind is refused.
  - `buy-flow.test.ts` (10 new cases), `record-payment.test.ts` (a covered kind leaves nothing due; `23505` maps to
    "This payment is already recorded.") and the migration test (one live row per kind).
- [ ] Playwright MCP as the Sales Manager on a GCE Visit cash buy: the form is prefilled, a double-click on Submit
  creates exactly one payment row, and the form then shows the "Recorded" note.
  - Not run here: the prescribed verification budget forbids Playwright and no dev server is running. Covered by
    `transaction-detail-sidebar-v1.test.tsx`: read-only prefill, double-click calls the action once, the note
    replaces the form. The single row is enforced by the partial unique index.
- [ ] Playwright MCP as the Head Accountant: no Record Payment form, no Mark Sold, and Verify/Reject show as normal
  buttons.
  - Not run here (same reason). Covered by `transaction-detail-sidebar-v1.test.tsx` (no form for the Head
    Accountant), `transaction-status-triage-v1.test.tsx` (no Mark Sold) and `transaction-payments-table-v1.test.tsx`
    (`data-size="sm"`, Verify default, Reject outline).
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.
  - `npx --no-install biome check --write` on every changed file: clean. Targeted `npx --no-install vitest run` on
    `src/lib/transactions` and `src/app/(staff)/transactions`: 23 files, 262 tests pass. The full test run, `tsc`
    and `build` were outside this subagent's budget; the integrator should run them.

---

[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)
