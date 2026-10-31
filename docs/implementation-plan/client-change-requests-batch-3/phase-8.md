[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)

**Status:** ✅ Done (2026-10-31, integration round).

> 2026-10-29: In Progress only because pre-existing work is ticked. Nothing new is built yet.
>
> 2026-10-31: Started implementation in worktree `b3-p8` (branch `batch3/p8`).
>
> 2026-10-31: All implementation tasks are built. The nav test and the new unit/component tests pass. The full-suite
> Done-when checks (Playwright MCP, `npm run check:fix`, `npx tsc --noEmit`, `npm run test`, `npm run build`) were not
> run in this worktree: the phase budget allowed only targeted `vitest` and `biome` runs on this memory-constrained
> machine. Left In Progress until the parent session runs them.

# Phase 8: CI Vehicle Papers tab

**Goal:** The Confidential Informant has a Vehicle Papers tab that lists the paper requests. A 3-dot menu on each row
shows the OR/CR, Deed of Sale and Policy & Warranty, and marks the papers Released.

Source: `docs/tasks/T05.md` (Confidential Informant: vehicle papers).

Assumption: "Released" is the existing `approvePapersRelease` step (`papers_status = 'handed_over'`), relabelled. No
new status. That step already notifies the Sales Manager, who then receives the papers.

Already there: the paper request flow in `sale_handovers` (`supabase/migrations/00058_t01_sale_handovers.sql`), its
actions in `src/app/(staff)/transactions/handover-actions.ts`, and the `PapersRequests` card in
`src/app/(staff)/field-cases/_components/papers-requests.tsx`.

## Dependencies

- None. Phase 9 adds the print pages that two menu entries open.

## Tasks

- [x] Sales Manager requests papers, CI approves and hands over, Sales Manager receives — already in
  `handover-actions.ts` (`requestPapersRelease` :106, `approvePapersRelease` :138, `receivePapers` :164).
- [x] Add "Vehicle Papers" to `src/navigation/sidebar/sidebar-items.ts` and to `ROLE_NAV_ACCESS` for
  `confidential_informant` and `ceo` in `src/lib/auth/roles.ts`. Added `roles.vehicle-papers.test.ts` in the style of
  `roles.attendance.test.ts`; it also asserts the sidebar link and that the Sales Manager does not get it.
- [x] Route `src/app/(staff)/vehicle-papers/page.tsx` with `requireRole(["confidential_informant", "ceo"])`. Reads the
  `sale_handovers` rows that have a `papers_status`, joined to the transaction, vehicle, buyer and
  `purchase_details.arrangement_kind`, with the admin client. The nested select follows
  `field-cases/page.tsx:79-97`; the row mapping is the tested `vehiclePaperRecord` helper.
- [x] `vehicle-papers/_components/vehicle-papers-table.tsx`: vehicle, buyer and status columns, plus a 3-dot
  `DropdownMenu` (pattern from `field-cases/_components/field-cases-table.tsx:197-236`) with View papers, Print Deed
  of Sale, Print Policy & Warranty and Mark Released. The trigger has an accessible name ("Actions for …").
- [x] View papers sheet: OR/CR is the signed URL of the `orcr` document on the car's earliest sell transaction (found
  by `vehicle_id`, signed with `src/lib/transactions/document-media.ts`), with the note "Original OR/CR — hand over
  the physical copy". With no file the sheet shows "Physical OR/CR kept by CI". The OR/CR has no print action.
- [x] Mark Released calls `approvePapersRelease` for `requested` rows; `released_to_ci` rows call
  `handPapersToBuyer`, and a `returned` meet-up/delivery row calls `releasePapersToCi`. The mapping lives in
  `src/lib/transactions/vehicle-papers.ts` and is unit tested. `handed_over` is relabelled "Released" in
  `src/lib/transactions/buy-flow.ts` (only that label line changed).
- [x] Moved the `PapersRequests` card out of Field Cases: removed the card, its query and the component file from
  `field-cases/`. The notification copy now points at Vehicle Papers.

## Verification (2026-10-31, worktree `b3-p8`)

- `npx --no-install vitest run src/lib/transactions/vehicle-papers.test.ts src/lib/auth/roles.vehicle-papers.test.ts "src/app/(staff)/vehicle-papers/_components/vehicle-papers-table.test.tsx" "src/lib/transactions/buy-flow.test.ts" "src/app/(staff)/transactions/handover-actions.test.ts"` — 5 files, 100 tests passed.
- `npx --no-install vitest run` on the related role/nav and papers suites (`roles.attendance`, `roles.ceo`,
  `roles.supplier`, `roles.sell-submissions`, `papers-gates`, `handover-actions`, `buy-flow`) — 7 files, 125 tests
  passed.
- `npx --no-install biome check --write` on every changed and new file — clean; the final `biome check` reported no
  fixes to apply.
- Not run here (budget): the Playwright MCP scenario, `npm run test`, `npx tsc --noEmit`, `npm run build`. The e2e
  helper `papersThenSold` and `buying-revision-phase2.spec.ts` were updated to the new tab and the "Released" label,
  but not executed.


Integration verification (2026-10-31)

- Merged into `batch3/integration` as `476cdfa`.
- Browser (Playwright MCP) as the Confidential Informant: "Vehicle Papers" appears in the sidebar and
  `/confidential_informant/vehicle-papers` renders the table with Vehicle, Buyer and Status columns.
  `handed_over` shows as "Released". The row 3-dot menu exposes exactly View papers, Print Deed of Sale,
  Print Policy & Warranty and a disabled "Released" entry on already-released rows; rows that are still
  actionable show "Mark Released". Both print entries navigate to the Phase 9 pages.
- Still to verify: the full Sales Manager request → CI Mark Released → Sales Manager receive chain
  through the UI. The action handlers are covered by `handover-actions` tests.


Integration verification (2026-10-31)

- Merged into `batch3/integration` as `476cdfa`.
- Full chain exercised in the browser with real clicks, across three roles on the Toyota Wigo `28284fe0`:
  1. Head Accountant verified the pending payments ("Payment verified.").
  2. Sales Manager clicked Request papers release ("Papers requested from the Confidential Informant.").
  3. Confidential Informant opened Vehicle Papers, found the row "Papers Requested", used the 3-dot menu,
     opened View papers — the sheet showed the OR/CR note "Original OR/CR — hand over the physical copy",
     the "Physical OR/CR kept by CI" fallback, and Print links for the Deed of Sale and Policy & Warranty.
  4. Mark Released produced "Papers released to the Sales Manager" and the row changed to "Released".
  5. Sales Manager saw "Status Released", clicked Receive papers ("Papers received.") and the status became
     "Papers Received"; Mark Sold then became available to the Sales Manager.
- The nav entry, the role guard and the table (Vehicle, Buyer, Status) were also confirmed for the CI.

## Done when

- [x] The role nav test passes.
- [ ] Playwright MCP: the Sales Manager requests papers. The CI sees the row in Vehicle Papers, opens the 3-dot menu,
  views the OR/CR and marks the papers Released. The Sales Manager sees "Released" and can receive the papers.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass. (Only targeted `biome` and
  `vitest` runs were allowed in this worktree; see Verification above.)

---

[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)
