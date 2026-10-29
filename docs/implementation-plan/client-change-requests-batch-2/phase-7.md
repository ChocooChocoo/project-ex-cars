[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)

**Status:** ✅ Done (2026-10-29). Not committed.

> 2026-10-29: Resumed with `/implement-phase`. Phase 6 is committed (`68d113d`), so the dependency is met.

# Phase 7: Attendance and leave

**Goal:** Every employee can clock in and out against a schedule (E1) and send leave requests to the Account Manager
(E5).

Decision: "Accountant Manager" is the Account Manager.

## Dependencies

- Phase 6 complete (new employees exist and need schedules)
- Working schedules from the client. Entering them is tracked in Phase 10; the code doesn't wait for them.

## Tasks

- [x] Clock in/out with present/late status and grace minutes — already in `src/app/(staff)/attendance/actions.ts:59-114`
  and migration `20260809134551_task18_staff_attendance.sql`.
- [x] Per-employee schedules (`employee_work_schedules`) set through `save_staff_record` — already in
  `20260809134551_task18_staff_attendance.sql:3-23, 421-519`.
- [x] Leave requests reviewed by CEO and Account Manager — already in `src/app/(staff)/employee-requests/actions.ts:11`.
- [x] Approved leave blocks clock-in — already in `20260809134551_task18_staff_attendance.sql:273-282`.
- [x] Check `src/navigation/sidebar/sidebar-items.ts` and `ROLE_NAV_ACCESS` in `src/lib/auth/roles.ts`, and add
  Attendance and Employee Requests for every staff role that lacks them.
  > 2026-10-29: Pages already allowed every staff role (`requireRole(STAFF_ROLES)`); only `ROLE_NAV_ACCESS` lacked the
  > links. Added `attendance` and `employee-requests` to confidential_informant, marketing_specialist, mechanic and
  > sales_manager, and `employee-requests` to head_accountant. Test `src/lib/auth/roles.attendance.test.ts` (8 roles):
  > 5 failed before, all pass after.
- [x] Add a "missing schedule" warning on the Staff Records page for employees without an `employee_work_schedules` row.
  > 2026-10-29: `isMissingSchedule` in `staff-table/columns.tsx`; the Schedule cell shows a "No schedule" badge, and
  > `staff-table/table.tsx` shows a destructive Alert naming everyone without a schedule ("cannot clock in until a
  > schedule is set"). Two tests added to `table.test.tsx` (flag shown / not shown); the first failed before.
  > `npx vitest run "src/app/(staff)/staff-records"`: 37 passed.

## Done when

- [x] Each of the 8 staff roles sees Attendance and Employee Requests in the sidebar.
  > 2026-10-29: Playwright MCP: all 8 roles have both links, and both pages open on the role path. The Marketing
  > Specialist could not log in at first ("Invalid login credentials": its hosted-DB password had been changed
  > elsewhere); with the user's approval its password was reset to the shared test password through the admin API
  > (that account only), then it passed too.
- [x] In the browser, the Mechanic clocks in and files a leave request, and the Account Manager approves it.
  Clock-in on the leave day is refused.
  > 2026-10-29: The seed Mechanic (mechanic@) has no schedule on the hosted DB, so the run used the Phase 6 Mechanics.
  > The Account Manager set Noel Ramirez (mechanic2) to Mon-Sun 08:00-17:00 in Staff Records; he clocked in ("Clocked
  > in.", Clock Out then enabled). Arnel Santiago (mechanic3) got the same schedule, filed a Leave request for
  > 2026-10-29 ("Request submitted."), the Account Manager approved it ("Request approved.", row shows approved), and
  > Arnel's Clock In was disabled with "Approved leave covers today." (the DB also refuses: "Approved leave applies
  > today."). Test data left on the hosted DB: those two schedules, Noel's open clock-in, Arnel's approved leave.
- [x] Staff Records flags any employee with no schedule.
  > 2026-10-29: As the Account Manager: alert "12 employees have no work schedule" with their names, and "No
  > schedule" badges in the rows; after setting Noel's schedule it read 11 and his name was gone. Finding: most seed
  > staff on the hosted DB have no schedule (the seed data's schedules are not there), so they cannot clock in until
  > one is set; real schedules are Phase 10's job.
  >
  > Checks: `npm run test` 106 files, 684 tests passed; `npx tsc --noEmit` clean; biome clean; `npm run build`
  > passes.

---

[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)
