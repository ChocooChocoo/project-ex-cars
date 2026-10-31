[Next: Phase 2 →](./phase-2.md)

**Status:** ✅ Done (2026-10-31, integration round).

# Phase 1: CI field case "Unauthorized" fix

**Goal:** A Confidential Informant who opens a delivery from Field Cases sees the case, not `/unauthorized`.

Source: `docs/tasks/T05.md` (Bug fix: Confidential Informant dashboard).

Root cause: Field Cases lists every case to every CI (`src/app/(staff)/field-cases/_components/field-cases-table.tsx:210-219`,
RLS in `supabase/migrations/20261026090000_t03_rbac_ceo_only.sql:208-214`). The detail page
`src/app/(staff)/field-cases/[id]/page.tsx:43-49` admits only the CI assigned to that case. So opening a delivery that
belongs to another CI, or to no CI, redirects to `/unauthorized`.

Decision (2026-10-29): any CI can view any field case in read-only mode. Actions stay with the assigned team.

## Dependencies

- None

## Tasks

- [x] Write a failing test for the access rule in `field-cases/[id]/page.tsx` (an unassigned CI is redirected today).
- [x] In `field-cases/[id]/page.tsx`, let `confidential_informant` view any `delivery` and `buyer_meetup` case. Keep
  `member` (:56-62) `null` when the CI is not assigned, so the action steps stay hidden.
- [x] Confirm that the server actions still refuse a CI who is not assigned: `src/app/(staff)/field-cases/delivery-actions.ts`
  (`DELIVERY_TEAM`, :21, :36-45) and `src/app/(staff)/transactions/handover-actions.ts:180-218`. Add a test if no
  test covers it.
- [x] Check that the other "Open delivery" links now open the case: `transactions/[id]/_components/delivery-panel.tsx:285`,
  `meetup-team-panel.tsx:91` and `sell-flow-panel.tsx:375`.


Integration verification (2026-10-31)

- Merged into `batch3/integration` as `4469eee`.
- Browser (Playwright MCP): signed in as the Confidential Informant `Carlos Mendoza` and opened delivery
  `022f0842-…`, which is assigned to another CI (`Liza Manalo`). The case rendered in full — schedule,
  buyer, vehicle, tracking, papers and contract sections — with no redirect to `/unauthorized` and no
  action buttons in the page body.
- Mechanic / other roles keep the assigned-only rule; `page.access.test.ts` covers both directions.
- Gates on the merged tree: `tsc --noEmit` exit 0, `vitest run --maxWorkers=2` 1017 passed / 148 files,
  `next build` exit 0, scoped biome clean.

## Done when

- [x] A unit test shows that an unassigned CI gets the page in read-only mode, and that a mechanic who is not on the
  case is still redirected.
- [ ] Playwright MCP: the CI opens a delivery assigned to another CI (or to no CI) from Field Cases. The case
  renders and no action buttons show.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

## Verification note — 2026-10-31

- `src/app/(staff)/field-cases/[id]/page.access.test.ts` (new): 5 tests. Red first (2 failed at the old
  `redirect("/unauthorized")` line), green after the change. Covers unassigned CI on `delivery` (renders with
  `member: null`) and `buyer_meetup` (`canRecordPapers: false`), the assigned CI keeping `member: "informant"`,
  an unassigned mechanic still redirected, and an unassigned CI still refused on `acquisition`.
- `src/app/(staff)/transactions/papers-gates.test.ts`: added a test that `advanceDeliveryStatus` still refuses a
  Confidential Informant who is not assigned (the existing `handover-actions.test.ts` already covers the papers
  actions, and `meetup-team.test.ts` covers `receiveFieldCase`).
- Commands: `npx --no-install vitest run` on the three new/changed suites plus `meetup-team`, `handover-actions`
  and `delivery-location` — 72 tests passed, 0 failed. `npx --no-install biome check` on the changed source files —
  clean.
- Task 4 is inspection only: all three panels already link to `/dashboard/field-cases/${fieldCase.id}`, which
  `src/proxy.ts` redirects to `/{role}/field-cases/{id}` for staff, so the fixed page opens for a CI.
- Deferred to the integration round (not run here per the memory budget): Playwright MCP check, `check:fix`,
  `tsc --noEmit`, full `npm run test`, `npm run build`.

---

[Next: Phase 2 →](./phase-2.md)
