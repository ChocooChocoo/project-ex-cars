[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)

**Status:** 🔄 In Progress

> 2026-10-29: In Progress only because pre-existing work is ticked. Nothing new is built yet.

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
- [ ] Add "Vehicle Papers" to `src/navigation/sidebar/sidebar-items.ts` and to `ROLE_NAV_ACCESS` for
  `confidential_informant` and `ceo` in `src/lib/auth/roles.ts`. Add a test like `src/lib/auth/roles.attendance.test.ts`.
- [ ] Route `src/app/(staff)/vehicle-papers/page.tsx` with `requireRole(["confidential_informant", "ceo"])`. Read the
  `sale_handovers` rows that have a `papers_status`, joined to the transaction, vehicle and buyer, with the admin
  client. Reuse the query from `src/app/(staff)/field-cases/page.tsx:79-97`.
- [ ] `vehicle-papers/_components/vehicle-papers-table.tsx`: vehicle, buyer and status columns, plus a 3-dot
  `DropdownMenu` (pattern from `field-cases/_components/field-cases-table.tsx:197-236`) with View papers, Print Deed
  of Sale, Print Policy & Warranty and Mark Released.
- [ ] View papers sheet: OR/CR = signed URL of the `orcr` document on the vehicle's earlier sell transaction (found
  by `vehicle_id`, signed with `src/lib/transactions/document-media.ts`), with the note "Original OR/CR — hand over
  the physical copy". With no file: "Physical OR/CR kept by CI". The OR/CR has no print action.
- [ ] Mark Released calls `approvePapersRelease` for `requested` rows. Meet-up and delivery rows use the existing
  `releasePapersToCi` / `handPapersToBuyer` steps. Relabel `handed_over` to "Released" in
  `src/lib/transactions/buy-flow.ts:213-222`.
- [ ] Move the `PapersRequests` card from Field Cases (`field-cases/page.tsx`) to this tab.

## Done when

- [ ] The role nav test passes.
- [ ] Playwright MCP: the Sales Manager requests papers. The CI sees the row in Vehicle Papers, opens the 3-dot menu,
  views the OR/CR and marks the papers Released. The Sales Manager sees "Released" and can receive the papers.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)
