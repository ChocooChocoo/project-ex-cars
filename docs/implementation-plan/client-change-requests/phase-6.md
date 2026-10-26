[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)

**Status:** 🔲 Not Started

# Phase 6: Document images and payment proof review

**Goal:** Sales Manager and Head Accountant see customer documents in a wider layout (SM1, HA1); the Head Accountant can
open a payment's proof photo before verifying (HA2) and rejects with a reason in a modal (HA3).

## Dependencies

- None inside this plan.
- Decision (2026-10-26): "Verify Check" means the payment proof image on the payments table.

## Background

- Documents render one per row at `h-48` in the narrow sidebar column:
  `src/app/(staff)/transactions/[id]/_components/transaction-detail-sidebar-v1.tsx:321-391`, inside
  `staff-transaction-detail.tsx:296` (`lg:grid-cols-3`, sidebar from `:338`).
- Image viewer with a larger `Dialog`: `src/components/transaction-image-preview.tsx`.
- Payments: `transaction-payments-table-v1.tsx:98-113` has a Verify button only, calling `verifyPayment`
  (`src/app/(staff)/transactions/actions.ts:637`).
- Document "Ask to resubmit" uses an inline `Input` for the reason (sidebar `:354-387`, `onRejectDocument` at
  `staff-transaction-detail.tsx:203`).

## Tasks

- [ ] SM1/HA1: move the documents list out of the sidebar into a full-width section of `staff-transaction-detail.tsx`
  with a `grid sm:grid-cols-2 lg:grid-cols-3` of `TransactionImagePreview` cards (verify controls kept per card).
- [ ] HA2: find where the payment proof image is stored (payment row or `transaction_documents` kind); show it as a
  clickable `TransactionImagePreview` thumbnail in each payment row, opening the large view.
- [ ] HA3: add `src/components/reject-reason-dialog.tsx` (`Dialog` + labelled `Textarea`, submit disabled until a reason
  is typed). Use it for payment Reject and for document "Ask to resubmit" (replacing the inline input).
- [ ] HA3: add `rejectPayment(paymentId, reason)` in `src/app/(staff)/transactions/actions.ts` (Head Accountant only,
  stores the reason, notifies the buyer with it through `notify()`); migration `00064_t03_payment_rejection_reason.sql`
  only if payments have no reason column yet.
- [ ] Customer `my-transactions/_components/transaction-detail.tsx`: show the rejected payment's reason.
- [ ] Unit tests: dialog disabled without reason; `rejectPayment` rejects other roles and stores the reason.
- [ ] Update `src/tests/e2e/buying-revision-phase1.spec.ts` selectors for the moved "Ask to resubmit" control.

## Done when

- [ ] On a transaction with 4 documents, the Sales Manager sees them in a grid of 2–3 per row on desktop and 1 per row at 390px.
- [ ] The Head Accountant clicks a payment's proof thumbnail and sees the large image, then closes it with Escape.
- [ ] Reject opens a modal; it cannot submit empty; with a reason the buyer is notified and sees the reason.
- [ ] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean.
- [ ] Walked with the Playwright MCP browser tools as Sales Manager, Head Accountant and buyer.

---

[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)
