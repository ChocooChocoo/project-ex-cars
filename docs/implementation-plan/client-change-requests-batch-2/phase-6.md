[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)

**Status:** ✅ Done (2026-10-28). Not committed.

> 2026-10-28: Started. User decisions: (1) the CEO **and** the Account Manager create employee accounts, even though
> T03 R2 (`20261026090000_t03_rbac_ceo_only.sql`) made `assign_user_role` CEO-only; a new migration adds a
> service-role-only function that sets a new employee's role (staff roles except `ceo`), so the Account Manager still
> cannot change existing roles or RBAC. (2) The hosted DB is not reseeded: only the 4 new Mechanic/CI accounts are
> created there; the seed scripts are updated for future runs. Note: the seed had one Mechanic and one CI, so 2 of
> each are added to reach 3 of each.

# Phase 6: Staff accounts

**Goal:** The seed has 3 Mechanic and 3 CI accounts (L3), and the CEO or Account Manager can create an account for a
new employee (E6).

Assumption: "3 accounts of Mechanic and CI" means 3 of each. Change the seed list if the client meant 3 in total.

## Dependencies

- None inside this plan (Phase 7 depends on this phase for new employees)

## Tasks

- [x] **L3:** In `scripts/seed-users.cjs:34-45`, add `mechanic2@gce.local`, `mechanic3@gce.local`,
  `confidential_informant2@gce.local` and `confidential_informant3@gce.local`, keeping the existing two.
  > 2026-10-28: Added Noel Ramirez, Arnel Santiago (mechanic2/3) and Rodel Pascual, Liza Manalo (CI 2/3).
- [x] **L3:** Give those accounts roles in `scripts/seed-roles.sql`, and include them in the user lookup in
  `scripts/seed-data.cjs:169-192` so field cases can be assigned to them.
  > 2026-10-28: `seed-roles.sql` and the `seed-data.cjs` lookup updated; field cases now pick among the three CIs and
  > three Mechanics, and all six get work schedules. `node --check` passes on both scripts. Not run (user decision).
- [x] **E6:** Add `createEmployeeAccount` to `src/app/auth/actions.ts`, next to `createWalkInAccount` (199-249), reusing
  its `admin.createUser` path with `email_confirm: true`:
  - Callers: `ceo` and `account_manager`.
  - Allowed roles: every staff role except `ceo`.
  - Set the role in `private.user_roles`.
  > 2026-10-28: Done. `assign_user_role` is CEO-only (T03 R2) and needs a session, so the role is set by the new
  > `public.set_new_employee_role` (`supabase/migrations/20261028130000_t04_employee_account_role.sql`): service_role
  > only, re-checks the actor is CEO or Account Manager, allows staff roles except `ceo`, and only promotes a fresh
  > `customer` row. Any failure after the user is created deletes it. `EMPLOYEE_ROLES` added to `src/lib/auth/roles.ts`.
  > Dry run listed only this migration; pushed. Live check: `service_role` can execute it, `anon` and
  > `authenticated` cannot.
- [x] **E6:** Add a "Create employee account" form in `src/app/(staff)/staff-records/_components/`, modeled on
  `walk-in-form.tsx`, with name, email, temporary password and role.
  > 2026-10-28: `employee-account-form.tsx` (Dialog, Select of `EMPLOYEE_ROLES`, PasswordInput + PasswordRules),
  > shown next to Create Walk-in Account for the CEO and the Account Manager on Staff Records.
- [x] Unit tests: role guard (customer and head_accountant refused, `ceo` role refused) and a created user getting the
  chosen role.
  > 2026-10-28: `src/app/auth/actions.employee.test.ts` (6 tests: success with the role RPC, unauthorized caller,
  > `ceo`/`customer`/`supplier` refused, user removed when the role cannot be set) and the migration test (5 tests).
  > Both failed before the code existed and pass after.

## Done when

- [x] After running the user seed and `npm run seed:data`, all 6 Mechanic and CI accounts log in and see their dashboards.
  > 2026-10-28: Seeds not rerun (user decision). The 4 new accounts were created on the hosted DB through the new form
  > by the Account Manager, with the same password as the other seed accounts. DB check: all six have the right role
  > and name. Playwright MCP: mechanic, mechanic2, mechanic3 land on `/mechanic/inspections`; the three CIs land on
  > `/confidential_informant/dashboard` (screenshot of CI 3's dashboard).
- [x] In the browser, the Account Manager creates a Mechanic account, and that account logs in to `/mechanic/...`.
  > 2026-10-28: Same run: the Account Manager created mechanic2 and mechanic3, and both log in to `/mechanic/inspections`.
- [x] `npm run test` passes.
  > 2026-10-28: 105 files, 674 tests passed. Two earlier full runs each had one 5 s timeout in the unrelated
  > `sell-vehicle-form.test.tsx` ("asks for the other issues text once Others is ticked", 5.8 s); it passes alone and
  > on the third full run. Flaky under load, not caused by this phase. `npx tsc --noEmit` clean, biome clean.

---

[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)
