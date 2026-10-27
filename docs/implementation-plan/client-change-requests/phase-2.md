[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** ✅ Done

Completed 2026-10-26.

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

- [x] R1: compared `ROLE_NAV_ACCESS.ceo` with every staff role's nav ids. The only product item missing was
  `create-walk-in`; added it in `src/lib/auth/roles.ts`. `sell-submissions` stays out on purpose (see notes).
- [x] R1: searched guarded staff pages and actions for role lists without the CEO. Findings:
  - `createWalkInAccount` (`src/app/auth/actions.ts`) now authorizes `["account_manager", "ceo"]`, and
    `staff-records/page.tsx` shows the walk-in form to the CEO too.
  - `sell-submissions/page.tsx` (`SELL_SUBMISSION_VIEWER_ROLES`): kept mechanic/CI only, by design.
  - `field-cases/delivery-actions.ts` and `vehicles/reconditioning-actions.ts`: worker actions for the assigned CI,
    mechanic or head security; the CEO is not a field worker, so unchanged.
- [x] R1: `src/lib/auth/roles.ceo.test.ts` asserts the CEO sees every nav item any staff role sees (except
  `sell-submissions`), plus the Account Manager rules below.
- [x] R2/R3: migration `supabase/migrations/20261026090000_t03_rbac_ceo_only.sql` (timestamp name, not `00063`,
  so it runs after the task30 RBAC migrations on a fresh reset):
  - recreates the 5 `rbac_*` write policies with `ur.role = 'ceo'` (the 5 read policies stay CEO + Account Manager);
  - recreates `update_rbac_role` and `assign_user_role` with a CEO-only guard;
  - deletes the Account Manager's `roles.read/create/update/assign` and `field_cases.read` rows from
    `rbac_role_permissions`;
  - recreates "Staff can read field cases" without `account_manager`.
  Test: `supabase/migrations/20261026090000_t03_rbac_ceo_only.test.ts`.
- [x] R2: `assignRole()` in `src/app/auth/actions.ts` is CEO-only.
- [x] R2: removed `roles` from the Account Manager's `ROLE_NAV_ACCESS`; `users`, `staff-records`,
  `create-walk-in`, `attendance` and `payroll` stay. `roles/page.tsx` now guards with `requireRole(["ceo"])`.
- [x] AM6: removed `field-cases` from the Account Manager's `ROLE_NAV_ACCESS` and `account_manager` from
  `FIELD_CASE_ROLES` in `src/app/(staff)/field-cases/page.tsx`.
- [x] Updated tests that pinned the old rules: `src/app/auth/actions.task33.test.ts` (walk-in roles) and
  `src/app/(staff)/_components/sidebar/search-dialog.task33.test.ts` (CEO now sees Create Walk-In).
  `roles/actions.test.ts`, `roles.test.tsx` and the e2e specs needed no change.
- [x] Applied the migration to the hosted Supabase project (`npx supabase db push`, run by the owner after the
  session's permission check blocked it; only this migration was pending).

## Done when

- [x] Signed in as the Account Manager, the sidebar shows no Roles and no Field Cases items, and
  `/account_manager/roles` and `/account_manager/field-cases` redirect to `/unauthorized`.
- [x] As the Account Manager, calling `update_rbac_role` or `assign_user_role` through the Supabase client returns a
  permission error ("Permission denied: only the CEO can manage RBAC" / "... can assign roles").
- [x] As the CEO, the Roles page opens with "Create Role" and "Edit" controls, and every staff nav item is visible
  (including Create Walk-In). Saving a permission change was not clicked, to leave the hosted RBAC data unchanged.
- [x] Staff Records still lets the Account Manager edit an employee (row menu shows Edit and Set Status).
- [x] `npm run test` passes (73 files, 491 tests), `npx tsc --noEmit` exits 0, biome on touched files is clean,
  `npm run build` exits 0.
- [x] Walked as CEO and Account Manager with the Playwright MCP browser tools (0 console errors).

## Verification (2026-10-26)

| Check | Result |
| --- | --- |
| New tests before the change | `roles.ceo.test.ts` 5 failed; migration test failed (file missing) |
| `npm run test` | 73 files, 491 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on touched files | clean |
| `npm run build` | compiled, exit 0 |
| Playwright MCP, Account Manager | sidebar without Roles/Field Cases; both URLs go to `/unauthorized`; walk-in dialog opens; Staff Records row menu has Edit |
| Playwright MCP, CEO | 24 nav items incl. Create Walk-In, Field Cases, Roles; Roles page has Create Role/Edit; walk-in dialog opens |
| Hosted migration | `20261026090000_t03_rbac_ceo_only.sql` applied |
| Supabase client as Account Manager | `update_rbac_role`: "Permission denied: only the CEO can manage RBAC"; `assign_user_role`: "Permission denied: only the CEO can assign roles"; insert into `rbac_permissions`: RLS violation; `field_cases` visible: 0 |
| Supabase client as CEO (same calls) | passes the guard and stops at "RBAC role not found" / "Invalid role" / foreign key; `field_cases` visible: 77 |
| Account Manager RBAC bundle | 54 permissions; none under `roles.*` or `field_cases.*`; `staff_records.*` kept |

The client checks used an unknown role key and an invalid role name, so a passed guard ends in an error and no
data changed.

## Files changed

- `src/lib/auth/roles.ts`, `roles.ceo.test.ts` (new)
- `src/app/auth/actions.ts`, `actions.task33.test.ts`
- `src/app/(staff)/roles/page.tsx`, `field-cases/page.tsx`, `staff-records/page.tsx`
- `src/app/(staff)/_components/sidebar/search-dialog.task33.test.ts`
- `supabase/migrations/20261026090000_t03_rbac_ceo_only.sql` (new), `.test.ts` (new)

## Notes and assumptions

- `sell-submissions` stays mechanic/CI only: it is their narrow view of cars the CEO already sees in Transactions,
  and `roles.sell-submissions.test.ts` pins that decision.
- The Account Manager keeps read access to the RBAC tables at the database level (read policies unchanged); only
  writes and role assignment are CEO-only. The Roles page and nav are closed to the Account Manager.
- `sell-inspection-actions.ts:199` still notifies the Account Manager when an inspection clears a car. That
  notification is about the transaction, not the field case; Phase 3 decides where it links.

---

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
