[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)

**Status:** 🔲 Not Started

# Phase 5: Finance pagination and disbursement detail

**Goal:** Every Finance table shows at most 10 rows per page with Next/Previous (HA5), and each disbursement request
opens a detail view with the full Purpose and its actions (HA4).

## Dependencies

- None inside this plan (can run in parallel with Phases 3–4 if needed).

## Background

- Reference layout: "Pending Price Approvals", `src/app/(staff)/vehicles/_components/price-approvals.tsx:395-470`
  ("Rows per page · Page X of N", TanStack `getPaginationRowModel` at `:270`). Same inline copy in
  `src/app/(staff)/payslips/_components/payslips-table.tsx:350`.
- Finance: `src/app/(staff)/finance/_components/finance-client.tsx` — Ledger (`:443-507`, informant copy `:376-439`) and
  Disbursements (`:519-588`) are raw tables, no paging. Server queries capped with `.limit(100)` (`finance/page.tsx:27,32`).
  Also `sale-records-card.tsx`, `field-expenses-card.tsx`.
- Disbursement Purpose truncated at `:544-546`; row actions at `:558-581`; `advance()` at `:219` calls
  `advanceDisbursement` (`finance/actions.ts:182`), which accepts optional `notes` (`src/lib/validation/phase6.ts:130-134`).

## Tasks

- [ ] Extract the pager from `price-approvals.tsx` into `src/components/table-pager.tsx`
  (`TablePager({ table })` for a TanStack table: rows-per-page select, "Page X of N", Previous/Next). Use it back in
  `price-approvals.tsx` and in `payslips-table.tsx`.
- [ ] Convert Ledger, the informant Ledger copy and Disbursements in `finance-client.tsx` to TanStack tables with
  `pageSize: 10` and `TablePager`.
- [ ] Same for `sale-records-card.tsx` and `field-expenses-card.tsx`.
- [ ] Decide on the `.limit(100)` caps in `finance/page.tsx`: raise or remove so older rows are reachable through paging
  (note the choice here).
- [ ] HA4: clicking a disbursement row opens a `Dialog` (`DisbursementDetail`) showing requester, amount, status,
  dates and the full Purpose.
- [ ] HA4: move Reject and the next-step button from the row into the dialog; Reject needs a reason saved via `notes`.
- [ ] Row is keyboard-reachable (button or link semantics) and announces it opens details.
- [ ] Unit test the dialog: full purpose text shown, Reject disabled without a reason, `advanceDisbursement` called with `notes`.

## Done when

- [ ] Each Finance tab with more than 10 rows shows 10 rows, "Page 1 of N", and Next moves to the next 10.
- [ ] Price Approvals and Payslips still page exactly as before.
- [ ] A disbursement with a 500-character purpose shows the whole text in the detail view.
- [ ] Rejecting a disbursement from the detail view stores the reason and updates the status.
- [ ] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean.
- [ ] Finance walked as the Head Accountant with the Playwright MCP browser tools.

---

[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)
