[Next: Phase 2 →](./phase-2.md)

**Status:** 🔲 Not Started

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

- [ ] Write a failing test for the access rule in `field-cases/[id]/page.tsx` (an unassigned CI is redirected today).
- [ ] In `field-cases/[id]/page.tsx`, let `confidential_informant` view any `delivery` and `buyer_meetup` case. Keep
  `member` (:56-62) `null` when the CI is not assigned, so the action steps stay hidden.
- [ ] Confirm that the server actions still refuse a CI who is not assigned: `src/app/(staff)/field-cases/delivery-actions.ts`
  (`DELIVERY_TEAM`, :21, :36-45) and `src/app/(staff)/transactions/handover-actions.ts:180-218`. Add a test if no
  test covers it.
- [ ] Check that the other "Open delivery" links now open the case: `transactions/[id]/_components/delivery-panel.tsx:285`,
  `meetup-team-panel.tsx:91` and `sell-flow-panel.tsx:375`.

## Done when

- [ ] A unit test shows that an unassigned CI gets the page in read-only mode, and that a mechanic who is not on the
  case is still redirected.
- [ ] Playwright MCP: the CI opens a delivery assigned to another CI (or to no CI) from Field Cases. The case
  renders and no action buttons show.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[Next: Phase 2 →](./phase-2.md)
