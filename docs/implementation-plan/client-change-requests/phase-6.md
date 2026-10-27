[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)

**Status:** ✅ Done

Completed 2026-10-26.

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

## Decisions (2026-10-26)

- No payment or cheque photo existed anywhere. Decision: staff attach an optional photo when recording a payment.
- A rejected payment stays on record as "Rejected" with the reason, stops counting, and the buyer is notified.

## Tasks

- [x] SM1/HA1: documents moved out of the narrow sidebar into a full-width `TransactionDocumentsCard`
  (`src/app/(staff)/transactions/[id]/_components/transaction-documents-card.tsx`): upload row on top, then a grid of
  1 / 2 / 3 columns (`sm:grid-cols-2 xl:grid-cols-3`). Verify rules unchanged (moved with the list).
- [x] HA2: migration `supabase/migrations/20261026100000_t03_payment_proof_rejection.sql` adds
  `payment_records.proof_path`, `rejected_by`, `rejected_at`, `rejection_reason`, and a check that a payment is never
  both verified and rejected (timestamped name so it runs after every existing migration). Applied to the hosted
  project with `npx supabase db push`.
- [x] HA2: Record Payment (sidebar) has "Photo of cheque / deposit slip (optional)"; `recordPayment` uploads it to
  `transaction-documents/{transaction}/payment-proof-*.{jpg,png,webp}` (JPG/PNG/WebP only) and removes the file if the
  row insert fails.
- [x] HA2: the staff page signs the photo with `withSignedTransactionDocumentUrls` (path never sent to the browser); the
  Payment Records table has a "Photo" column with a small thumbnail that opens the large view
  (`TransactionImagePreview` gained a `triggerClassName` for the small size).
- [x] HA3: `src/components/reject-reason-dialog.tsx` (modal, labelled textarea, confirm disabled until a reason is typed),
  used for payment Reject and for document "Ask to resubmit" (replaces the inline "What to fix" field).
- [x] HA3: `rejectPayment(paymentId, reason)` in `src/app/(staff)/transactions/payment-review-actions.ts` — CEO and Head
  Accountant only (same as `verifyPayment`); only a pending payment; stores who/when/why; reopens an installment the
  payment had marked paid (`installmentStateFor` in `buy-flow.ts`: overdue / due / upcoming by due date); notifies the
  buyer with the reason; audit event. `verifyPayment` now refuses a rejected payment.
- [x] Rejected payments never count: `paidTowardPrice` skips them; the staff page passes only counted payments to the
  progress card, sidebar and delivery panel; the Payment Records strip excludes them ("Rejected · not counted");
  Finance "Sale records" excludes them. The dashboard already counts verified payments only.
- [x] Verify / Reject on payments are shown only to the CEO and Head Accountant (before, every role saw a Verify button
  the server then refused).
- [x] Customer `transaction-detail.tsx`: a rejected payment shows "Not accepted", the amount struck through and the reason.
- [x] Tests: migration test; `paidTowardPrice` and `installmentStateFor` cases; `payment-review-actions.test.ts` (role,
  reason, already reviewed, stored reason + notify, installment reopened); `transaction-payments-table-v1.test.tsx`
  (photo opens, reason modal, rejected row not counted, hidden for other roles);
  `transaction-documents-card.test.tsx` (grid, PDF link, preview, resubmit modal, role).
  Sidebar test trimmed (document tests moved).
- [x] `src/tests/e2e/buying-revision-phase1.spec.ts`: "Ask to resubmit" now opens the modal. Document buttons keep the
  exact name "Verify", which many e2e specs count.

## Done when

- [x] On a transaction with several documents, the Sales Manager sees them side by side (3 per row at 1440px, 1 per
  row at 390px).
- [x] The Head Accountant clicks a payment's photo thumbnail and sees the large view, then closes it with Escape.
- [x] Reject opens a modal; it cannot submit empty; with a reason the payment shows "Rejected" + reason, the buyer gets
  "A payment was not accepted" with the reason and sees it on the transaction page.
- [x] `npm run test` passes (81 files, 532 tests; two unrelated tests timed out once under load and pass on rerun),
  `npx tsc --noEmit` exits 0, biome on touched files is clean, `npm run build` compiles.
- [x] Walked with the Playwright MCP browser tools as Sales Manager, Head Accountant and buyer.

## Verification (2026-10-26)

| Check | Result |
| --- | --- |
| New tests before the change | migration, `paidTowardPrice`, `payment-review-actions` failed; documents card failed until built |
| Document grid (MCP, Sales Manager) | 3 cards side by side at x=313/671/1030, none left in the sidebar; 390px: one per row, no page overflow |
| Record payment with photo (MCP, Sales Manager) | "Payment recorded."; DB `proof_path` set; thumbnail appears after the page refresh (about 5 s on the dev server) |
| Roles (MCP) | Sales Manager sees no Verify/Reject on payments; Head Accountant sees Photo, Verify, Reject |
| Photo (MCP, Head Accountant) | thumbnail opens the large view; Escape closes it |
| Verify (MCP) | "Payment verified."; row "Verified" |
| Reject (MCP) | modal "Reject this payment?", confirm disabled until a reason; "Payment rejected. The buyer is notified."; row "Rejected" + reason |
| Totals (MCP) | Total paid ₱500,999.00 (rejected ₱1,234 left out); Rejected 1 · not counted |
| Buyer (MCP) | notification "A payment was not accepted … E2E: amount on the cheque does not match" opens the transaction; Financial Summary shows "Not accepted", struck amount, reason |
| Ask to resubmit (MCP, Sales Manager) | upload → modal (confirm disabled when empty) → "Resubmission requested…" → card shows "To fix: …" |
| Console errors | 0 |

Screenshots: `test-results/mcp-phase6-*.png`.

### Live site walk (2026-10-27)

Playwright MCP on https://global-exchange-car.vercel.app (`main` at `e8426b6`, same hosted Supabase project).
Test records are tagged `LIVE-QA`.

| Role | Checked | Result |
| --- | --- | --- |
| Sales Manager | Documents 3 per row (x=326/684/1043); recorded ₱1,111 and ₱2,222 with photos on E2E transaction `642417bd`; no Verify/Reject for SM | pass |
| Head Accountant | Photo opens large; Verify ₱2,222 → "Verified"; Reject ₱1,111 (confirm disabled until a reason) → "Payment rejected. The buyer is notified." | pass |
| Totals | Total paid ₱2,222 (rejected left out); Rejected 1 · not counted | pass |
| Buyer | Notification opens the transaction; Financial Summary "Cash · Not accepted ₱1,111.00, Reason: LIVE-QA: …" | pass |
| Ask to resubmit (SM) | Modal "Ask for a new Valid ID?", confirm disabled when empty → "Resubmission requested. The uploader is notified." → "To fix: …" | pass |

Note: a reject dialog opened within 3 s of a Verify closed on its own once (the page refresh after Verify). Opened
again after the refresh, it worked.

Screenshot: `test-results/live-phase6-ha-payments.png`.

## Notes

- Found and fixed during the walk: the "Total paid" caption said "all records" (now "verified and pending"); the
  resubmit modal title lowercased the label ("valid id" → now "Valid ID").
- Test data added to the hosted database: on "E2E Test ONSITE" (`ba0f8862…`) payments ₱1,234 (rejected) and ₱999
  (verified), both with the test photo; on "E2E Test P4-MEETUP" (`e115f989…`) one test Valid ID asked to be resubmitted.
- The payment photo goes through the server action like the existing ID uploads, so the 4 MB server-action limit
  applies; switch to signed browser uploads (as Sell a Car does) if staff need larger photos.

---

[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)
