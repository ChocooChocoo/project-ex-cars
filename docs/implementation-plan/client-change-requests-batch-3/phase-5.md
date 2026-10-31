[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)

**Status:** Done for the answered six-role scope (2026-10-29). CEO and Head Security schedules deferred. Not committed.

> 2026-10-29: Implementation started after the user approved proceeding with the answered requirements and deferring
> unanswered questions. Scope: the six role schedules below, existing active staff, new accounts, editable defaults,
> seed data, and verification. Head Security and CEO schedules remain unchanged. No commits authorized.
> The original global "no missing-schedule alert" criterion is narrowed to the six specified roles under that
> instruction. The alert remains visible for the two unspecified roles; no schedule is invented to hide it.

# Phase 5: Work schedules by role

**Goal:** Every employee has their role's work schedule (Mon–Sat), and late clock-ins are counted against it.

Source: `docs/tasks/T05.md` (Attendance: work schedules by role).

Decision (2026-10-29): Mon–Sat. Hours per T05: Head Accountant 9:00 AM–6:00 PM; Sales Manager, Account Manager and
Marketing Specialist 8:00 AM–5:00 PM; Confidential Informant and Mechanic 7:00 AM–4:00 PM.

Assumption: the role schedules overwrite the current schedules, because the client's list is the source. Head
Security is not in T05 and stays unchanged. This also covers "E1 data" in
`docs/implementation-plan/client-change-requests-batch-2/phase-10.md`.

Already there: clock-in with present/late status and grace minutes, per-employee `employee_work_schedules`, and
`save_staff_record` (see the tasks below).

## Dependencies

- None

## Tasks

- [x] Per-employee schedules, clock-in/out and late status — already in
  `supabase/migrations/20260809134551_task18_staff_attendance.sql` and `src/app/(staff)/attendance/actions.ts`.
- [x] `src/lib/attendance/role-schedules.ts`: `ROLE_WORK_SCHEDULES` with the hours above, workdays `[1, 2, 3, 4, 5, 6]`
  and grace 10. Write a unit test.
- [x] Migration `supabase/migrations/20261029120000_t05_role_schedules.sql` (+ `.test.ts`): upsert
  `employee_work_schedules` for every active employee in those 6 roles, using the `ON CONFLICT (employee_id)` shape
  from `save_staff_record`.
- [x] `createEmployeeAccount` (`src/app/auth/actions.ts:273-328`): insert the role schedule with the admin client, so
  a new employee can clock in right away.
- [x] Staff Records sheet (`src/app/(staff)/staff-records/_components/staff-table/table.tsx:113-116`): prefill from
  `ROLE_WORK_SCHEDULES` when the employee has no schedule. Saving stays editable.
- [x] `scripts/seed-data.cjs:1299-1328`: use the role map instead of one schedule for everyone.
- [x] Tick the answered six-role portion of "E1 data" in `client-change-requests-batch-2/phase-10.md` with a note pointing here.

## Implementation and verification (2026-10-29)

- `role-schedules.json` is the shared data source for the typed `ROLE_WORK_SCHEDULES` export and the CommonJS seed
  script. This avoids a TypeScript-runtime requirement for seeds and duplicate application/seed hour maps. The SQL
  contract test compares all six migration role/hour rows against that map.
- `actions.employee.test.ts`: role scheduling and failure-cleanup tests failed before the implementation, then passed.
  `table.test.tsx`: missing-schedule default test failed before the change; now passes, including editable times,
  preserved existing schedules and blank defaults for unspecified Head Security. No layout or styling changes.
- The new-account action removes the half-created user if the schedule insert fails. Only the six specified roles
  receive automatic schedules. The Staff Records sheet still requires Save; prefilling does not write data.
- Applied only `20261029120000_t05_role_schedules.sql` to the linked development project `nsdwyxwrsmtarrxgzeuj`, with
  explicit project-URL matching and a single transaction. Verified all 10 active employees in the six covered roles
  matched the map, and all other existing schedules were unchanged. No attendance or payroll rows were modified by
  the migration. Applied through `pg`; this does not claim a Supabase CLI migration-history entry.
- Pre-migration backup: `C:/Users/marka/AppData/Local/Temp/opencode/t05-schedules-before-1793252030695.json`.
- Isolated PGlite SQL execution passed: six-role assignments, overwriting an existing covered schedule, preservation
  of original `created_by`, unchanged CEO/Head Security and suspended/inactive staff, and repeat-run idempotence.
  Temporary harness: `C:/Users/marka/AppData/Local/Temp/opencode/purchase-rpc-proof/role-schedules-proof.mjs`.
- `npm run check:fix -- <8 changed TS/JSON files>` passed (scoped to avoid changing unrelated user work).
  `node --check scripts/seed-data.cjs` passed. Did not run the seed script, which wipes and recreates data.
- `npm run test -- --maxWorkers=2`: **113 files, 731 tests passed**. `npx tsc --noEmit` passed.
  `npm run build` passed. `git diff --check` passed for the modified application/seed files.

## Browser verification (Playwright MCP, 2026-10-29)

All browser actions used visible login forms, sidebar links, search, menus and buttons. No direct API calls, DOM
injection, forced server times or database writes were used to make browser tests pass. The schedule migration above
was the implementation step, not a test shortcut.

1. Account Manager -> Staff Records -> 20 rows per page: inspected all 12 original staff. All 10 covered employees
   show Mon-Sat and the correct role hours. Missing-schedule warning fell from 9 employees to 2: Gregorio Villanueva
   (Head Security) and Roberto Gonzales (CEO). Both remain unchanged under the user's deferral instruction.
2. Create Employee Account -> created clearly labelled `Schedule Browser Test`, Mechanic,
   `phase5.schedule.browser.20261029@gce.local`. Its row immediately showed Mon-Sat 07:00-16:00, without manually
   setting a schedule.
3. Signed out -> signed in as that new Mechanic -> Attendance. Schedule showed 07:00-16:00, 10-minute grace;
   Clock In was enabled. Clicked Clock In at 13:35 PHT: the row showed **Late**, summary Late 1, On duty, and
   disabled Clock In. This proves both new-account clock-in and late classification after 07:10 with real clicks.
4. Clicked Clock Out. Signed back in as Account Manager -> Attendance -> searched `Schedule Browser Test`:
   one row on Oct 29, 2026, In 13:35, Out 13:35, status Late. No open test shift remains.
5. Staff Records -> test user's Set Status -> archived. Verified row status archived. Test account and its closed
   attendance entry remain as labelled evidence, not an additional active Mechanic.
6. Current-page console errors: 0. Evidence:
   `test-results/batch-3-phase-5-new-mechanic-late.yml`, `.png`,
   `test-results/batch-3-phase-5-closed-attendance.yml`, and `test-results/batch-3-phase-5-console-errors.log`.

## Deferred items

- Do not add CEO or Head Security schedules without a specification. Consequently, the global warning still lists
  those two employees. All specified-role employees have schedules.
- Batch 2 Phase 10 remains incomplete for S1 and accountant-confirmed payroll policy. No other Batch 3 phase was
  implemented. The only Batch 2 update is the explicit E1 cross-reference task above.

## Done when

- [x] The role map test and the migration test pass.
- [x] Every active employee in the six specified roles has a schedule matching T05. Warnings for unspecified CEO
  and Head Security schedules are explicitly deferred, not hidden.
- [x] Playwright MCP: a Mechanic who clocks in after 07:10 is marked late, and a new employee account can clock in
  right away.
- [x] Scoped `npm run check:fix`, `npx tsc --noEmit`, `npm run test -- --maxWorkers=2` and `npm run build` pass.

---

[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)
