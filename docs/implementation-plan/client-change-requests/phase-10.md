[← Previous: Phase 9](./phase-9.md) | [Next: Phase 11 →](./phase-11.md)

**Status:** ✅ Done

Completed 2026-10-27.

# Phase 10: OR/CR and ID verification

**Goal:** Submitted OR/CRs (C11, Sell a Car) and buyer IDs (SM2, Sales Manager → Transactions) are checked by a
verification service when one is configured; without one, they are flagged for manual review exactly as today.

## Dependencies

- Phase 8 complete (Sell a Car upload flow is final).
- Decision (2026-10-26): provider-agnostic verifier, chosen by environment variable, manual fallback. The Technical
  Adviser still has to name the real providers; until then the fallback runs.

## Background

- Documents: `transaction_documents` (`document_kind`, `storage_path`, `verification_state`, `id_type`,
  `rejection_reason`). ORCR is uploaded in `submitSellVehicle` (`src/app/(customer)/sell-vehicle/actions.ts:612-769`);
  IDs in the buy flow (`src/app/(customer)/my-transactions/actions.ts`).
- Manual verify: `canVerify` (`transaction-detail-sidebar-v1.tsx:119-125`), `verifyTransactionDocument`
  (`src/app/(staff)/transactions/actions.ts:737`).

## Tasks

- [x] Migration `00067_t03_document_auto_verification.sql`: `transaction_documents.auto_check_status TEXT CHECK (IN
  ('verified','failed','manual_review'))`, `auto_check_provider TEXT`, `auto_check_detail TEXT`, `auto_checked_at TIMESTAMPTZ`.
  Named `20261027100000_t03_document_auto_verification.sql` (timestamp naming, as phase 9). Also adds trigger
  `guard_document_auto_check`: the customer insert policies do not limit these columns, so `anon`/`authenticated`
  sessions get them cleared on insert and kept on update. Only the service role writes the result.
- [x] `src/lib/verification/verify-document.ts`: `verifyDocument(kind: "orcr" | "valid_id", file: { path, idType? })`
  returns `{ status, provider, detail }`. Reads `ORCR_VERIFY_PROVIDER` / `ID_VERIFY_PROVIDER` (+ API key) from env;
  no provider or a provider error → `manual_review`. Server-only, never exposes keys to the client.
  API keys: `ORCR_VERIFY_API_KEY` / `ID_VERIFY_API_KEY`. The provider registry is empty (no provider named yet), so an
  unknown name also means `manual_review`. `autoCheckDocument()` runs the check and saves it with the admin client;
  it never throws.
- [x] Unit test `verify-document.test.ts`: no env → `manual_review`; provider throws → `manual_review`; stub provider
  result passed through. Also: unknown provider name → `manual_review`; API key handed to the provider.
- [x] Call `verifyDocument` after ORCR upload in `submitSellVehicle` and after ID upload in the buy flow; save the result;
  never block the customer's submission on it.
  Both actions are in `src/app/(customer)/my-transactions/actions.ts` (`submitSellVehicle`, `uploadPurchaseDocument`).
  The check runs in `after()` from `next/server`, so it starts once the response is sent; the customer neither waits
  for nor fails on it. Test in `actions.test.ts`.
- [x] Staff sidebar: show a badge per document ("Auto-check: verified / failed / needs manual review") next to the manual
  Verify control; manual verification stays the final decision.
  The documents moved out of the sidebar in an earlier phase, so the badge is in `transaction-documents-card.tsx`,
  above Verify / Ask to resubmit, with the provider's detail under it. Failed uses the destructive badge. Documents
  never auto-checked (older rows, seller IDs, staff uploads) show no badge.
- [x] Document in `.env.example` (or the existing env docs) the variables and that the fallback is manual.
- [x] Apply migration 00067. `npx supabase db push` (dry run listed only this migration).

## Done when

- [x] With no provider env set, a new sell ORCR and a buyer ID both get `manual_review` and staff see the badge.
- [x] With a stub provider (test only) returning `failed`, staff see "failed" and can still verify manually.
- [x] Customer submission succeeds even when the provider call throws.
- [x] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean.

## Verification (2026-10-27)

| Check | Result |
| --- | --- |
| `npm run test` | 90 files, 576 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | succeeded |
| Biome on touched files | clean (`npx biome check` on the changed files) |
| Hosted migration | applied with `npx supabase db push` |
| Sell flow (`t01-phase1-selling.spec.ts` "seller submits") | passed; the new ORCR row has `auto_check_status = manual_review`, detail "No verification service is set up." |
| Buy flow (`buying-revision-phase1.spec.ts` "opens an image") | passed; all three buyer IDs, including the replacement, have `manual_review`; Verify and Ask to resubmit still work |
| Guard trigger | a customer session inserted a document with `auto_check_status = 'verified'`: stored as NULL. The service role could set it. Test row deleted |
| Staff UI | Marketing Specialist (1280 px) sees "Auto-check: needs manual review" on the ORCR above Verify; Sales Manager (390 px) sees it on each buyer ID, no overflow |
| Failed result | unit tests: a stub `failed` passes through; the card shows "Auto-check: failed" and Verify is still there (test only, as planned) |
| Provider throws | unit test: `manual_review`; action test: the upload returns success before the check runs |
| Live, failed + throw | Two test-only adapters were added for one run and then removed: one returns `failed`, one throws. Set with `ORCR_VERIFY_PROVIDER=__e2e_fail` and `ID_VERIFY_PROVIDER=__e2e_throw`. Sell submit passed; the ORCR was saved as `failed`. Buyer ID uploads passed, including the resubmission; the server log shows the error 6 times; each ID was saved as `manual_review` ("The verification service did not answer."). Marketing Specialist saw the red "Auto-check: failed" badge with the detail, clicked Verify, and the ORCR became `verified` |

### Live site walk (2026-10-27)

Playwright MCP on https://global-exchange-car.vercel.app (`main` at `e8426b6`, same hosted Supabase project).
Test records are tagged `LIVE-QA`.

| Role | Checked | Result |
| --- | --- | --- |
| Sell flow | New ORCR (`c9096cad`) shows "Auto-check: needs manual review · No verification service is set up." for SM and Marketing | pass |
| Marketing | Verify on that ORCR → "Document verified."; badge stays | pass |
| Buy flow | Customer uploaded 2 IDs on `d03bf62c` and submitted; SM sees "Auto-check: needs manual review" on both, with Verify and Ask to resubmit | pass |
| Staff upload | ID uploaded by the SM gets no badge (as planned) | pass |
| Failed / throw adapters | Skipped: needs Vercel env changes | n/a |

Note: staff (SM and CEO) get a 404 for a buy transaction until the customer submits it.

Screenshots: `test-results/live-phase10-*.png`.

## Files changed

- `supabase/migrations/20261027100000_t03_document_auto_verification.sql` (new), `.test.ts` (new)
- `src/lib/verification/verify-document.ts` (new), `verify-document.test.ts` (new)
- `src/app/(customer)/my-transactions/actions.ts`, `actions.test.ts`
- `src/app/(staff)/transactions/[id]/_components/transaction-documents-card.tsx`, `transaction-documents-card.test.tsx`
- `.env.example`

## Assumptions and notes

- Only the seller's ORCR and the buyer's IDs (uploaded by the customer) are auto-checked, as the tasks say. The
  seller's IDs in Sell a Car and documents staff upload are not.
- No real provider exists yet. To add one: write an adapter in `PROVIDERS` in `verify-document.ts` and set
  `ORCR_VERIFY_PROVIDER` / `ID_VERIFY_PROVIDER` to its name. The adapter receives the storage path and downloads the
  file itself.
- The dev server's `.next/dev` cache was stale (every route answered 404). Clearing it fixed that; not a code issue.

---

[← Previous: Phase 9](./phase-9.md) | [Next: Phase 11 →](./phase-11.md)
