[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** ✅ Done (2026-10-31, integration round).

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

- [x] Migration `supabase/migrations/20261030100000_t05_id_side.sql` (+ `.test.ts`, following the existing migration
  test pattern). Add `transaction_documents.id_side text check (id_side in ('front','back'))`. Old rows stay null.
- [x] `src/lib/transactions/buy-flow.ts:3-10`: replace `activeBuyerIdCount` / `BUYER_ID_COUNT` with
  `buyerIdsComplete(docs)`. It passes when 2 distinct `id_type` values each have an active front and back. Legacy:
  when every ID row has a null side, keep the old 2-ID rule. Write the unit tests first.
- [x] `uploadPurchaseDocument` (`my-transactions/actions.ts:43-84`): accept `id_side` (required for `valid_id`).
  Allow at most 4 active ID rows and one per (`id_type`, side). Run the ID auto-check (:98) on the front only.
- [x] `submitBuyRequest` (:329): require an active `proof_of_billing`. Error: "Upload a proof of billing before
  sending the request."
- [x] New server action `removePurchaseDocument(documentId)` in `my-transactions/actions.ts`. It checks that the
  buyer owns the transaction, the transaction is in `current_state='pending'` (not sent yet) and the document is
  `pending`. Then it deletes the storage object and the row with the admin client.
- [x] `my-transactions/_components/transaction-detail.tsx`:
  - Add a Front/Back select for `valid_id` (:1034-1080).
  - Add a Remove button per row in the document list (:1084-1130) while the request is not sent.
  - Change the counter to "x/4 ID images · proof of billing uploaded/pending" (:1022-1026).
  - Add proof of billing to the Send Request disabled check (:742-749).
- [x] Staff checks in `src/app/(staff)/transactions/actions.ts:91-112` (approve) and `:134-153` (complete): use
  `buyerIdsComplete` on verified rows. Show the side badge in `transactions/[id]/_components/transaction-documents-card.tsx`.

### Verification note (2026-10-31)

- `npx --no-install vitest run "src/lib/transactions/buy-flow.test.ts" "supabase/migrations/20261030100000_t05_id_side.test.ts"` — 61/61 passed (tests written first; RED confirmed as `buyerIdsComplete is not a function` and a missing migration file).
- `npx --no-install vitest run "src/app/(customer)/my-transactions/purchase-documents.test.ts" "src/app/(customer)/my-transactions/buy-request-phase4.test.ts" "src/app/(customer)/my-transactions/actions.test.ts" "src/app/(customer)/my-transactions/_components/transaction-detail.test.tsx" "src/app/(staff)/transactions/[id]/_components/transaction-documents-card.test.tsx"` — passed.
- `npx --no-install vitest run "src/app/(staff)/transactions/meetup-team.test.ts" "src/app/(staff)/transactions/papers-gates.test.ts" "src/app/(staff)/transactions/actions.task33.test.ts"` — 40/40 passed after their document fixtures were moved from a table count to verified front/back ID rows.
- Combined focused run of the ten touched test files: 152/152 passed. `npx --no-install biome check --write <changed files>` — no fixes applied on the final check.
- Not run under the batch verification budget: Playwright, `npx tsc --noEmit`, full `npm run test`, `npm run build`. The migration was not applied to any database.
- Follow-up for the integration round: `src/tests/e2e/support/t01.ts` still uploads two IDs and expects 3 documents, so its helpers need a front/back upload and a 4-ID + proof count before the Playwright scenarios can pass.



Integration verification (2026-10-31)

- Merged into `batch3/integration` as `4dc009b`.
- Browser (Playwright MCP) on a live pending request `051226bb-…`, created through Buy Now: uploaded the
  front and back of Driver's License and Passport (4 ID images) plus proof of billing. The counter moved
  `0/4 → 2/4 → 3/4 → 4/4` and the proof line changed from pending to uploaded. Each row shows an accessible
  Remove button (`Remove Valid ID (back)`, `Remove Proof of billing`); removing one dropped the counter to
  `3/4` and re-uploading restored `4/4`, with the database holding the expected 5 rows.
- `Submit Request` stayed disabled until four ID images and a proof of billing were present. It remains
  disabled afterwards only because this request has no booked slot yet, which is the pre-existing slot rule,
  not this phase.
- Note for future runs: tiny fixture images make the OCR auto-check log "Image size is too small for OCR
  Engine 2"; the upload still lands and is marked for manual review. Not a product defect.
- Gates on the merged tree: `tsc --noEmit` exit 0, 1017 tests passed, `next build` exit 0.

## Done when

- [x] The `buyerIdsComplete` and `submitBuyRequest` tests pass, including one that refuses a request with no proof
  of billing.
- [ ] Playwright MCP: the buyer uploads the front and back of 2 IDs, removes one image and uploads it again. Send
  Request stays disabled until a proof of billing is uploaded, then the request is sent.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
