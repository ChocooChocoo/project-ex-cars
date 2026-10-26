[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** 🔲 Not Started

# Phase 2: RBAC — CEO full access, Account Manager without RBAC

**Goal:** The CEO has full access (R1). The Account Manager manages employees but cannot grant RBAC access, either in
the app or directly against the database (R2, R3), and loses Field Cases (AM6).

## Dependencies

- Phase 1 complete (sidebar labels settled, so nav tests are written once).

## Background

- The CEO role already exists in `src/lib/auth/roles.ts` (`GCE_ROLES`, `STAFF_ROLES`, `ROLE_NAV_ACCESS:199`), the
  `private.user_roles` CHECK (`00001_phase1_schema.sql:43-55`) and the seed. R1 is an audit, not a new role.
- No trigger grants RBAC when an account is created. The Account Manager gets RBAC through the RBAC seed
  (`20260818062528_task30_seed_system_permissions.sql:113-116`: `field_cases.*`, `roles.create/update/assign`) and through
  database rules that allow `account_manager` to write `rbac_*` tables and call `update_rbac_role` / `assign_user_role`.
- The app layer is already CEO-only for RBAC writes (`src/app/(staff)/roles/actions.ts:33-36`, `roles/page.tsx:50`).

## Tasks

- [ ] R1: list every staff nav id in `src/navigation/sidebar/sidebar-items.ts` and confirm `ROLE_NAV_ACCESS.ceo`
  includes each one; add missing ids.
- [ ] R1: `grep -rn '"ceo"' src/app/(staff)` for page guards and action role lists that leave out the CEO; add the CEO
  where the CEO should see or act (record each change in this file).
- [ ] R1: add a test in `src/lib/auth/roles.ceo.test.ts` asserting the CEO can reach every staff nav item.
- [ ] R2/R3: migration `supabase/migrations/00063_t03_rbac_ceo_only.sql`:
  - recreate the 10 `rbac_*` write policies from `20260818052430_task30_rbac_management.sql:155-298` with
    `role = 'ceo'` only (reads stay ceo + account_manager);
  - recreate `update_rbac_role` and `assign_user_role` (`00013_restore_rls_and_secure_role_rpcs.sql:106-150`) with a
    CEO-only guard;
  - delete the `roles.create`, `roles.update`, `roles.assign` and `field_cases.*` rows for `account_manager` from
    `rbac_role_permissions`;
  - recreate "Staff can read field cases" (`00038_rbac_least_privilege.sql:236-241`) without `account_manager`.
- [ ] R2: in `src/app/auth/actions.ts:152-158`, make `assignRole()` CEO-only (it is unused today; keep it consistent).
- [ ] R2: remove `roles` from the Account Manager's `ROLE_NAV_ACCESS` (`roles.ts:227-228`). Keep `users` and
  `staff-records` so the Account Manager still manages employees.
- [ ] AM6: remove `field-cases` from `ROLE_NAV_ACCESS.account_manager` (`roles.ts:242`) and `account_manager` from
  `FIELD_CASE_ROLES` (`src/app/(staff)/field-cases/page.tsx:10-18`).
- [ ] Update `src/app/(staff)/roles/actions.test.ts`, `roles/_components/roles.test.tsx`,
  `src/app/(staff)/_components/sidebar/search-dialog.task33.test.ts` and the e2e `task33-corrective-workflows.spec.ts`
  where they expect the old Account Manager access.
- [ ] Apply migration 00063 to the hosted Supabase project (`npx supabase db push`).

## Done when

- [ ] Signed in as the Account Manager, the sidebar shows no Roles and no Field Cases items, and `/account_manager/field-cases`
  redirects to `/unauthorized`.
- [ ] As the Account Manager, calling `update_rbac_role` or `assign_user_role` through the Supabase client returns a
  permission error (checked with a short script or SQL as that user).
- [ ] As the CEO, the Roles page can still change a role's permissions, and every staff nav item is visible.
- [ ] Staff Records still lets the Account Manager edit an employee's record.
- [ ] `npm run test` passes (including the new CEO test), `npx tsc --noEmit` exits 0, biome on touched files is clean.
- [ ] Walked as CEO and Account Manager with the Playwright MCP browser tools.

---

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
