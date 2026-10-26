[← Previous: Phase 9](./phase-9.md) | [Next: Phase 11 →](./phase-11.md)

**Status:** 🔲 Not Started

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

- [ ] Migration `00067_t03_document_auto_verification.sql`: `transaction_documents.auto_check_status TEXT CHECK (IN
  ('verified','failed','manual_review'))`, `auto_check_provider TEXT`, `auto_check_detail TEXT`, `auto_checked_at TIMESTAMPTZ`.
- [ ] `src/lib/verification/verify-document.ts`: `verifyDocument(kind: "orcr" | "valid_id", file: { path, idType? })`
  returns `{ status, provider, detail }`. Reads `ORCR_VERIFY_PROVIDER` / `ID_VERIFY_PROVIDER` (+ API key) from env;
  no provider or a provider error → `manual_review`. Server-only, never exposes keys to the client.
- [ ] Unit test `verify-document.test.ts`: no env → `manual_review`; provider throws → `manual_review`; stub provider
  result passed through.
- [ ] Call `verifyDocument` after ORCR upload in `submitSellVehicle` and after ID upload in the buy flow; save the result;
  never block the customer's submission on it.
- [ ] Staff sidebar: show a badge per document ("Auto-check: verified / failed / needs manual review") next to the manual
  Verify control; manual verification stays the final decision.
- [ ] Document in `.env.example` (or the existing env docs) the variables and that the fallback is manual.
- [ ] Apply migration 00067.

## Done when

- [ ] With no provider env set, a new sell ORCR and a buyer ID both get `manual_review` and staff see the badge.
- [ ] With a stub provider (test only) returning `failed`, staff see "failed" and can still verify manually.
- [ ] Customer submission succeeds even when the provider call throws.
- [ ] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean.

---

[← Previous: Phase 9](./phase-9.md) | [Next: Phase 11 →](./phase-11.md)
