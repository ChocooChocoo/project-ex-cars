[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)

**Status:** 🔲 Not Started

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

- [ ] Pre-check: query the hosted DB for duplicate `payment_records` rows (same `transaction_id` + `payment_kind`,
  `rejected_at is null`, `installment_id is null`). Clean any duplicates with the user's approval before the
  migration runs.
- [ ] Migration `supabase/migrations/<timestamp>_t05_payment_once.sql` (+ `.test.ts`): partial unique index on
  `payment_records(transaction_id, payment_kind)` where `installment_id is null and rejected_at is null and
  payment_kind <> 'reschedule_fee'`.
- [ ] `src/lib/transactions/buy-flow.ts`: add `nextDuePayment(purchaseDetails, payments, flowStatus)`, which returns
  `{ kind, amount, method } | null` for the 3 CASH arrangements. Build it on `paidTowardPrice`,
  `paymentAllowedBeforeSigning` and `onlinePaymentsDue`. Write the unit tests per arrangement first.
- [ ] `recordPayment` (`src/app/(staff)/transactions/actions.ts:556-650`): for a CASH buy, ignore the client's
  amount and kind and use `nextDuePayment`. Map the unique violation `23505` to "This payment is already recorded."
  Allow `head_accountant` only for `installment_id` rows, so the financing "Record paid" button stays.
- [ ] `transaction-detail-sidebar-v1.tsx:298-387`:
  - Pass `purchaseDetails` and `paymentTerms` in from `staff-transaction-detail.tsx`.
  - Show the form only to `sales_manager`.
  - Make amount, payment kind and method read-only from `nextDuePayment`. The proof photo stays.
  - Disable the button while the submit is pending (`useTransition`).
  - Once the payment is recorded, replace the form with "Recorded, waiting for the Head Accountant's check."
- [ ] Remove `head_accountant` from approved → completed (`src/lib/transactions/state-machine.ts:100-101`), so Mark
  Sold leaves the Head Accountant's triage.
- [ ] `transactions/[id]/_components/transaction-payments-table-v1.tsx:137-158`: change Verify/Reject from ghost
  `h-6 px-2 text-xs` to `size="sm"` buttons (Verify default, Reject outline or destructive).
- [ ] Update the existing tests that expect the Head Accountant to Mark Sold or record a payment.

## Done when

- [ ] The `nextDuePayment` tests pass, and a test shows that a second payment of the same kind is refused.
- [ ] Playwright MCP as the Sales Manager on a GCE Visit cash buy: the form is prefilled, a double-click on Submit
  creates exactly one payment row, and the form then shows the "Recorded" note.
- [ ] Playwright MCP as the Head Accountant: no Record Payment form, no Mark Sold, and Verify/Reject show as normal
  buttons.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)
