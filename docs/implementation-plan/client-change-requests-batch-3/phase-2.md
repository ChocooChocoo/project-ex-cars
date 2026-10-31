[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** 🔲 Not Started

# Phase 2: Buyer request documents

**Goal:** A buyer cannot send a buying request without a proof of billing, must upload the front and back of both
IDs, and can remove an image uploaded by mistake.

Source: `docs/tasks/T05.md` (Buyer: buying request).

Decision (2026-10-29): keep the 2-ID rule and add a side (front or back) to each ID upload, so 4 ID images in total.

Today: `submitBuyRequest` (`src/app/(customer)/my-transactions/actions.ts:329`) checks only the ID count. Proof of
billing is checked only when staff approve. No front/back exists. Customers have no DELETE RLS on
`transaction_documents` or the `transaction-documents` bucket (`actions.ts:654`).

## Dependencies

- None

## Tasks

- [ ] Migration `supabase/migrations/20261030100000_t05_id_side.sql` (+ `.test.ts`, following the existing migration
  test pattern). Add `transaction_documents.id_side text check (id_side in ('front','back'))`. Old rows stay null.
- [ ] `src/lib/transactions/buy-flow.ts:3-10`: replace `activeBuyerIdCount` / `BUYER_ID_COUNT` with
  `buyerIdsComplete(docs)`. It passes when 2 distinct `id_type` values each have an active front and back. Legacy:
  when every ID row has a null side, keep the old 2-ID rule. Write the unit tests first.
- [ ] `uploadPurchaseDocument` (`my-transactions/actions.ts:43-84`): accept `id_side` (required for `valid_id`).
  Allow at most 4 active ID rows and one per (`id_type`, side). Run the ID auto-check (:98) on the front only.
- [ ] `submitBuyRequest` (:329): require an active `proof_of_billing`. Error: "Upload a proof of billing before
  sending the request."
- [ ] New server action `removePurchaseDocument(documentId)` in `my-transactions/actions.ts`. It checks that the
  buyer owns the transaction, the transaction is in `current_state='pending'` (not sent yet) and the document is
  `pending`. Then it deletes the storage object and the row with the admin client.
- [ ] `my-transactions/_components/transaction-detail.tsx`:
  - Add a Front/Back select for `valid_id` (:1034-1080).
  - Add a Remove button per row in the document list (:1084-1130) while the request is not sent.
  - Change the counter to "x/4 ID images · proof of billing uploaded/pending" (:1022-1026).
  - Add proof of billing to the Send Request disabled check (:742-749).
- [ ] Staff checks in `src/app/(staff)/transactions/actions.ts:91-112` (approve) and `:134-153` (complete): use
  `buyerIdsComplete` on verified rows. Show the side badge in `transactions/[id]/_components/transaction-documents-card.tsx`.

## Done when

- [ ] The `buyerIdsComplete` and `submitBuyRequest` tests pass, including one that refuses a request with no proof
  of billing.
- [ ] Playwright MCP: the buyer uploads the front and back of 2 IDs, removes one image and uploads it again. Send
  Request stays disabled until a proof of billing is uploaded, then the request is sent.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
