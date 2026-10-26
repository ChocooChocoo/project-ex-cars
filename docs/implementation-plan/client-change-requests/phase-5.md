[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)

**Status:** ✅ Done

Completed 2026-10-26, not committed.

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

- [x] Added `src/components/table-pager.tsx`: `usePagedRows(rows)` (fixed 10 rows, clamps the page if rows shrink)
  and `TablePager` ("1–10 of N", "10 rows per page", "Page X of N", Previous/Next, labelled `<nav>`). The rows-per-page
  select was left out on purpose: T03 caps Finance tables at 10 rows per page. Test: `table-pager.test.tsx`.
- [x] ~~Reuse the extracted pager in `price-approvals.tsx` and `payslips-table.tsx`~~ — dropped: both already page
  correctly with TanStack and their own select; rewriting them adds risk for no change the client asked for.
- [x] Ledger: the two duplicated ledger tables (normal and informant view) became one `LedgerTable` with the pager.
- [x] Disbursements: `DisbursementsTable` with the pager.
- [x] `sale-records-card.tsx` (now a client component) and `field-expenses-card.tsx` use the pager.
- [x] `.limit(100)` on ledger entries, disbursements and sale records raised to `.limit(1000)` (the API's row cap), so
  rows past 100 are reachable through paging.
- [x] HA4: each disbursement row opens a detail dialog (whole row clickable; the title is a button named
  "Open {title}" for keyboard use) with requester date, amount, status, the full Purpose (wrapped, scrolls after
  16rem) and notes.
- [x] HA4: Reject and the next-step button moved from the row into the dialog. Reject needs a typed reason
  ("Reason for rejecting"); it is sent as `notes` and stored on the `rejected` disbursement event.
- [x] Fixed an existing bug found in the browser: the success toast read "Disbursement rejectd." (label + "d"); it now
  uses the event name ("Disbursement rejected.", "… marked paid.").
- [x] Tests in `finance-client.test.tsx`: ledger shows 10 of 12; disbursements show 10 of 11; full purpose in the
  dialog; Reject disabled without a reason, sends `event_kind=rejected` with the reason, toast "Disbursement
  rejected."; the existing "approve" test now opens the detail view first.

## Done when

- [x] Each Finance table with more than 10 rows shows 10, "Page 1 of N", and Next moves to the next 10 (Ledger 40 →
  4 pages, Disbursements 30 → 3, Sale records 58 → 6; Field expenses 7 → 1 page).
- [x] Price Approvals and Payslips page exactly as before (not touched).
- [x] A disbursement with a 724-character purpose shows the whole text in the detail view.
- [x] Rejecting a disbursement from the detail view stores the reason and updates the status (database: status
  `rejected`, event note "E2E: no quotation attached").
- [x] `npm run test` passes (77 files, 515 tests), `npx tsc --noEmit` exits 0, biome on touched files is clean,
  `npm run build` compiles.
- [x] Finance walked as the Head Accountant (and the CEO to file the test request) with the Playwright MCP browser.

## Verification (2026-10-26)

| Check | Result |
| --- | --- |
| New tests before the change | pager test failed (module missing); 5 finance tests failed on the old component |
| `npm run test` | 77 files, 515 tests passed |
| `npx tsc --noEmit` / biome / `npm run build` | exit 0 / clean / compiled |
| Paging (MCP, Head Accountant) | Ledger "1–10 of 40 · Page 1 of 4", Next → "11–20 of 40 · Page 2 of 4"; Disbursements "1–10 of 30"; Sale records "1–10 of 58"; Field expenses "1–7 of 7" |
| Detail view (MCP) | opened with Enter on the title; shows status, purpose, notes; "Receive" for a released request; Escape closes |
| Reject (MCP + DB) | Reject disabled until a reason is typed; after Reject the dialog closes and the row shows "rejected"; DB event note saved |
| 390px (MCP) | no page-level horizontal scroll; table scrolls inside its card; pager fits; dialog fits the screen |
| Console errors | 0 |

Screenshots: `test-results/mcp-phase5-*.png`.

### Follow-up live checks (2026-10-26)

| Check | Result |
| --- | --- |
| Toasts (MCP) | "Disbursement rejected.", "… approved.", "… released.", "… received.", "… marked paid." all shown |
| Full flow (MCP) | test request moved Approve → Release → Receive → Mark Paid from the detail view; ends "Paid" with only Close |
| Previous/Next (MCP, CEO) | Ledger, Sale records and Disbursements: Previous disabled on page 1, Next/Previous move by 10, Next disabled on the last page (e.g. "51–58 of 58"); Field expenses single page |
| CEO (MCP) | all four tables paged; detail view shows Reject (with reason field) and Approve |
| Account Manager (MCP) | Record Entry / Request Disbursement / Request Purchase Funds; no Verify; no Sale records card; detail view read-only (Close only) |
| Confidential Informant (MCP) | banner shown; ledger collapsed, 0 entries with "No financial entries recorded." and no pager; own 7 requests paged; detail read-only |
| 390px light mode (MCP) | no page-level horizontal scroll; pagers and detail dialog fit |
| Console errors | 0 |

One crash during this run ("Failed to execute 'removeChild' on 'Node'") was caused by the test script deleting
Sonner's toast elements from the DOM by hand; rerun without that, no error.


## Notes

- The walks added five test disbursements to the hosted database, all titled "E2E T03 P5 …": "reject test"
  (₱1,234, rejected), "toast reject" (rejected), "reject toast 2" (rejected), "full flow" (paid), "approve toast"
  (approved). None is linked to a transaction, so none has side effects.
- The reject reason is stored on the disbursement's event history (`disbursement_events.notes`), not on the request's
  own `notes`, so the requester's notes are never overwritten.
- Paging is client-side over at most 1000 rows per table; move to server paging if a table grows past that.

---

[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)
