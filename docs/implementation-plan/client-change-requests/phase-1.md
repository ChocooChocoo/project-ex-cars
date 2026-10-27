[Next: Phase 2 →](./phase-2.md)

**Status:** ✅ Done

Completed 2026-10-26.

# Phase 1: Quick fixes and removals

**Goal:** Ship the small renames, removals and one-line bug fixes from T03 (G2, G4, G5, SM3, SM4, AM1, AM2, AM3) so
every role sees cleaner screens before the larger work starts.

Source: `docs/tasks/T03.md`.

## Dependencies

- None

## Tasks

- [x] GCE logo component — already in `src/components/gce-logo.tsx` (uncommitted).
- [x] App name changed from "Studio Admin" to "GCE" — already in `src/config/app-config.ts` and
  `src/app/(staff)/_components/sidebar/app-sidebar.tsx` (uncommitted).
- [x] G2: change `title: "Default"` to `title: "Dashboard"` in `src/navigation/sidebar/sidebar-items.ts:81`. Kept
  `id: "default"`, because `ROLE_NAV_ACCESS` (`src/lib/auth/roles.ts`) and the fallback in `app-sidebar.tsx` use it.
- [x] G4: in `app-sidebar.tsx`, show "GCE Admin" for staff roles and "Global Car Exchange" for the customer.
  Done through `brandFor(role)` in the new `src/app/(staff)/_components/sidebar/sidebar-brand.ts`.
- [x] G4: brand link goes to `landingPath(role)` for the customer (`/customer/showroom`) and to
  `/{role}/dashboard` for staff (also for the Sales Manager and Marketing Specialist, whose landing page is Vehicles).
- [x] G5 + AM2: removed the PHP/EUR/GBP/USD balance map and its `Select` from
  `src/app/(staff)/staff-recommendations/_components/inventory-allocation.tsx`; amounts use `formatCurrency` with its
  PHP default.
- [x] G5: replaced `DollarSign` with lucide `PhilippinePeso` in `recommendation-form.tsx`, `vehicles-columns.tsx` and
  `vehicle-detail-widgets.tsx` (`metric-cards.tsx` is handled in Phase 4). Also replaced the reachable
  `CircleDollarSign` in `dashboard/_components/phase6-overview.tsx` and
  `transactions/_components/recent-transactions-table/columns.tsx` (added scope, see notes).
- [x] SM3 + AM1: removed `<NotificationsPanel>` and the unused `getNotifications` call from
  `src/app/(staff)/dashboard/page.tsx`, and deleted `dashboard/_components/notifications-panel.tsx`. The header bell stays.
- [x] SM4: `src/app/(staff)/vehicles/_components/vehicles-columns.tsx` adds the `actions` column only when
  `canManage` or `canDelete` is true.
- [x] AM3: `src/app/(staff)/staff-records/page.tsx` maps over `staffProfiles` instead of all `profiles`; header copy is
  "Manage employee accounts." and the card text is "Staff accounts with role, schedule, and status."
- [x] Tests: `sidebar-brand.test.ts` (new, 4 cases), 2 new cases in `vehicles-columns.test.tsx`, and the e2e spec
  `src/tests/e2e/client-changes-phase1.spec.ts` (new) for the screens.

## Done when

- [x] The staff sidebar shows "Dashboard", not "Default", for Head Accountant, Sales Manager, Account Manager and
  Marketing Specialist (one shared nav item; checked in the browser for Sales Manager and Account Manager).
- [x] The staff sidebar header reads "GCE Admin" and opens the role dashboard; the customer header reads
  "Global Car Exchange" and opens `/customer/showroom`.
- [x] `grep -rnE "EUR|GBP|USD" src --include=*.tsx --exclude-dir=template` returns no currency options (no matches).
- [x] Sales Manager and Account Manager dashboards have no notification list at the bottom.
- [x] Sales Manager Vehicles table has no Action column; Marketing Specialist still has it (CEO covered by the
  `canDelete` unit case).
- [x] Staff Records lists no customer accounts (8 staff accounts shown).
- [x] `npm run test` passes, `npx tsc --noEmit` exits 0, `npx biome check` on the touched files has no findings.
- [x] The screens above are walked in a real browser (Playwright spec, see Verification).

## Verification (2026-10-26)

| Check | Result |
| --- | --- |
| New unit tests before the change | `vehicles-columns` "drops the Actions column" failed as expected; `sidebar-brand` failed (module missing) |
| `npm run test` | 71 files, 481 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on the 14 touched files | no findings |
| `npm run build` | compiled, exit 0 |
| Currency grep (Done-when command) | no matches |
| `npx playwright test client-changes-phase1` (dev server on :3000, hosted Supabase) | 4 of 4 passed |

What the Playwright spec walks: Sales Manager (Vehicles without Actions column, "Dashboard" link, "GCE Admin" opens
`/sales_manager/dashboard` with no notification list), Marketing Specialist (Actions column present), Account Manager
(Staff Records without customers, Inventory Allocation without a balance selector), customer ("Global Car Exchange"
opens the Showroom, plus a 390px screenshot).

Screenshots: `test-results/client-phase1-*.png`.

### Playwright MCP browser walk (2026-10-26)

| Role | Checked | Result |
| --- | --- | --- |
| Sales Manager | Sidebar link "Dashboard", no "Default"; Vehicles headers end at Mileage (no Actions); "GCE Admin" → `/sales_manager/dashboard`; no notification list on the dashboard | pass |
| Marketing Specialist | Actions column present; menu has Edit, Propose Price (peso icon), Publish, Archive | pass |
| CEO | Brand → `/ceo/dashboard`; Vehicles tab has Actions with Delete; no notification list on the dashboard | pass |
| Account Manager | "Dashboard" label; no notification list; Staff Records shows "8 Accounts", roles all staff (no customer); Inventory Allocation card has no select, amounts in ₱ | pass |
| Head Accountant | "Dashboard" label, brand → `/head_accountant/dashboard`, no notification list | pass |
| Customer | "Global Car Exchange" → `/customer/showroom`; at 390px the label fits in the mobile sidebar sheet without truncation | pass |
| Console | Errors across the whole walk | 0 |

Screenshots: `test-results/mcp-phase1-*.png`. The dashboard still shows template metric cards and the mock
"18,426 Customers" table; that is Phase 4 (G3) scope, not a Phase 1 regression.

### Live site walk (2026-10-27)

Playwright MCP on https://global-exchange-car.vercel.app (`main` at `e8426b6`, same hosted Supabase project).
Test records are tagged `LIVE-QA`.

| Role | Checked | Result |
| --- | --- | --- |
| Sales Manager | "Dashboard" label, no "Default"; Vehicles headers end at Mileage (no Actions); "GCE Admin" → `/sales_manager/dashboard`; no notification list | pass |
| Marketing Specialist | Actions column; menu Edit, Propose Price, Publish, Archive | pass |
| CEO | Brand → `/ceo/dashboard`; Vehicles view has Actions with Delete; no notification list | pass |
| Account Manager | "8 Accounts", no customer rows; Inventory Allocation without a select, amounts in ₱ | pass |
| Head Accountant | "Dashboard" label, brand → `/head_accountant/dashboard` | pass |
| Customer | "Global Car Exchange" → `/customer/showroom`; 390px: label fits (159/159 px), no page overflow | pass |
| Console | React error #418 (hydration text mismatch) on most pages: the server renders dates in UTC, the browser in local time (e.g. "4:48 AM" vs "12:48 PM"). Live only, because Vercel runs in UTC. Not caused by this phase | finding |

Screenshots: `test-results/live-phase1-*.png`.

## Files changed

- `src/navigation/sidebar/sidebar-items.ts`
- `src/app/(staff)/_components/sidebar/app-sidebar.tsx`, `sidebar-brand.ts` (new), `sidebar-brand.test.ts` (new)
- `src/app/(staff)/staff-recommendations/_components/inventory-allocation.tsx`
- `src/app/(customer)/recommendations/_components/recommendation-form.tsx`
- `src/app/(staff)/vehicles/_components/vehicles-columns.tsx`, `vehicles-columns.test.tsx`
- `src/app/(staff)/vehicles/[id]/_components/vehicle-detail-widgets.tsx`
- `src/app/(staff)/dashboard/page.tsx`, `_components/phase6-overview.tsx`, `_components/notifications-panel.tsx` (deleted)
- `src/app/(staff)/transactions/_components/recent-transactions-table/columns.tsx`
- `src/app/(staff)/staff-records/page.tsx`
- `src/tests/e2e/client-changes-phase1.spec.ts` (new)
- Already uncommitted before this phase: `src/config/app-config.ts`, `src/components/gce-logo.tsx`

## Notes and assumptions

- `brandFor` lives in its own small module because importing `app-sidebar.tsx` in a unit test pulls in `next/font`,
  which Vitest cannot load.
- Suppliers share the sidebar; they see "Global Car Exchange" and go to `/supplier/overview` (T03 names only staff
  and customer).
- The GCE logo is marked `aria-hidden` next to the text label, so screen readers hear the name once.
- Added scope: the two reachable `CircleDollarSign` icons were swapped too. Template, legacy, CRM and e-commerce
  pages keep their dollar icons; no role can reach them.
- The screens were checked twice: with the Playwright spec and with the Playwright MCP browser. The MCP tool echoes
  the code it runs, so the seed test password was printed in the session; rotate `SEED_USER_PASSWORD` if that matters.
- Contrast was not re-measured: no colours changed.

---

[Next: Phase 2 →](./phase-2.md)
