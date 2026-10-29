[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)

**Status:** ✅ Done (2026-10-29). Not committed.

> 2026-10-29: Started with `/implement-phase`. Phase 7 is Done, so the dependency is met.
>
> Decisions made with the user on 2026-10-29 (they refine the calculation below):
> - **No double charge for lateness.** The "Regular hours" line pays the full scheduled hours for each attended day.
>   The "Late / undertime" line deducts the minutes short of the schedule (late arrival plus early leave). Net pay
>   equals the hours actually worked. The `late_minutes` column is not charged separately, because a late arrival
>   already shortens `hours_worked`.
> - **No clock-out pays 0 hours.** A checked day with no `hours_worked` pays nothing. The Account Manager fixes the
>   entry or adds a manual item.
> - Assumption: an employee with no `employee_work_schedules` row uses 8 hours a day, and the calculation note says so.

# Phase 8: Hours-based payroll, overtime and deductions

**Goal:** Payroll pays each employee for hours on duty (E2), pays overtime separately at 125% (E3), and deducts late
minutes and manual items (E4).

Decisions:
- Overtime is paid at 125% of the hourly rate (PH Labor Code). It counts only on days with an approved `overtime`
  employee request.
- Deductions: late/undertime minutes, plus manual items, on top of SSS, PhilHealth and Pag-IBIG.

## Dependencies

- Phase 7 complete (attendance with schedules and approved overtime requests)

## Tasks

- [x] Add a pure `computePayslip()` in `src/lib/payroll/compute.ts`. Inputs: monthly salary, schedule and checked
  attendance entries. Calculation:
  - Hourly rate = `base_salary_cents / 30 / scheduled_hours_per_day`.
  - Regular pay = min(`hours_worked`, scheduled hours) × hourly rate.
  - Overtime pay = hours beyond the schedule on days with an approved overtime request × hourly rate × 1.25.
  - Late deduction = `late_minutes` × minute rate.

  > 2026-10-29: Done in `src/lib/payroll/compute.ts`, with the "no double charge" rule above. Each attended day
  > (`hours_worked` > 0) adds the scheduled hours to Regular hours. The time short of the schedule becomes
  > `shortMinutes`, and the Late / undertime deduction is `shortMinutes × hourly rate / 60`. The hourly rate is rounded
  > to whole cents first, so the calculation note matches the amount. An overtime range is
  > `start_date ≤ date ≤ end_date ?? start_date`. Also exports `scheduledHours()` and `DEFAULT_SCHEDULED_HOURS = 8`.
- [x] Unit tests in `src/lib/payroll/compute.test.ts`: regular day, half day, overtime with and without approval, late
  minutes, and rounding to whole cents.

  > 2026-10-29: 9 cases, written before the code (first run failed: module missing). They also cover a multi-day
  > overtime request and a missing clock-out. `npx vitest run src/lib/payroll`: 9 passed.
- [x] Replace the day-weight logic in `createPayrollRun` (`src/app/(staff)/payroll/actions.ts:94-231`, `PAID_DAYS` at
  :21) with `computePayslip`. Load approved overtime requests for the period from `employee_requests`.

  > 2026-10-29: `PAID_DAYS` and `WORKING_DAYS_PER_MONTH` removed. `createPayrollRun` now also loads
  > `employee_work_schedules` and approved `overtime` requests with `start_date <= period_end`, groups by employee and
  > calls `computePayslip`. Late / undertime is added to `deductions_cents`. `actions.test.ts` updated: hours-based
  > totals, late/undertime once, overtime with an approved request, no overtime without one. 8 passed.
- [x] Write separate `payslip_items` rows: "Regular hours" and "Overtime hours" (earnings), and "Late / undertime"
  (deduction), each with a `calculation_note` (hours × rate).

  > 2026-10-29: Lines with a ₱0 amount are not written. `source_value` holds the hours (or minutes for Late /
  > undertime). Example notes: `20.00 h × ₱100.00/h (base salary / 30 / 10 h a day)`,
  > `2.00 h × ₱100.00/h × 1.25 (approved overtime)`, `330 min × ₱100.00/h ÷ 60 (late arrival and early leave)`.
  > Verified by the `actions.test.ts` assertions on exact rows.
- [x] Manual deductions (cash advance, etc.) on draft payslips — already in `addPayslipItem`
  (`src/app/(staff)/payroll/actions.ts:353-404`).
- [x] SSS, Pag-IBIG and PhilHealth deductions — already in `createPayrollRun` (`payroll/actions.ts:171-177`).
- [x] Show regular hours and overtime hours on the payslip view in `src/app/(staff)/payslips/`.

  > 2026-10-29: `payslips/[id]/page.tsx` reads the hours from the "Regular hours" and "Overtime hours" items.
  > `payslip-detail-client.tsx` shows "Regular Hours" and "Overtime Hours" rows at the top of the Summary card. Older
  > day-based payslips have no such items, so the rows are hidden there. `npx tsc --noEmit` is clean and
  > `npm run build` passes. Seen in the browser on 2026-10-29 (see the browser test note below).

## Done when

- [x] `npm run test` passes with the new `compute.test.ts` cases.

  > 2026-10-29: `npm run test`: 107 files, 695 tests passed. Biome reports no issues in the changed files. Repo-wide
  > `npm run check` still fails on existing issues in files this phase did not touch (`scripts/seed-data.cjs`,
  > `scripts/run-migration.*`, `reconditioning-overview.tsx`).
- [x] In the browser, Create Run on seed data produces payslips with separate Regular hours, Overtime hours and
  Late / undertime lines whose totals match the calculation note.
- [x] An employee with extra hours but no approved overtime request gets no overtime line.

  > 2026-10-29 browser test (Playwright MCP, done by clicking and typing as each user, with no direct data edits):
  > 1. Signed in as the Account Manager (`account_manager@gce.local`). Staff Records → Edit Carlos Mendoza → set a
  >    Mon–Fri 08:00–17:00 schedule. Toast: "Account details updated."
  > 2. Signed in as Carlos (`confidential_informant@gce.local`). Requests → New Request → Overtime, 08/06/2026 to
  >    08/06/2026. On that date his checked attendance shows 9.35 h.
  > 3. Signed in as the Account Manager. Requests → Review request → Approve. The status shows "approved".
  > 4. Payroll → Create Run, 07/20/2026 to 08/07/2026. Toast: "Payroll run created from checked attendance." The run
  >    shows gross ₱35,232.07, deductions ₱99.99, net ₱35,132.08, and 6 draft payslips.
  > 5. Carlos's payslip (base ₱20,000, 9 h schedule): Summary shows Regular Hours 90.00 h and Overtime Hours 0.35 h.
  >    The lines are:
  >    - Regular hours: `90.00 h × ₱74.07/h` = ₱6,666.30.
  >    - Overtime hours: `0.35 h × ₱74.07/h × 1.25` = ₱32.41.
  >    - Late / undertime: `81 min × ₱74.07/h ÷ 60` = ₱99.99.
  >
  >    Net pay is ₱6,598.72. Every amount matches its note.
  > 6. Benjamin Tan's payslip (base ₱32,000, no schedule): one line, `48.00 h × ₱133.33/h (… 8 h a day, no work
  >    schedule on file)` = ₱6,399.84, and Overtime Hours 0.00 h. On 08/06/2026 he has 9.1 h of checked attendance
  >    but no approved overtime request, so there is no Overtime line.
  >
  > No browser console errors after the dev server restart.
  >
  > Notes:
  > - The dev server's compile worker crashed partway through ("Jest worker encountered 2 child process exceptions").
  >   This was most likely caused by running `npm run build` while `next dev` was running. Restarting `npm run dev`
  >   fixed it. It was not caused by the app code.
  > - Test data left in the database: Carlos's work schedule, his approved overtime request for 08/06/2026, and a
  >   draft payroll run for 07/20/2026 – 08/07/2026.
  > - Outside this phase: amounts use `toLocaleString()` with no fixed decimals, so ₱6,666.30 is shown as "₱6,666.3".
  >   10 of 12 staff in this database have no work schedule, so they are paid on the 8-hour default.

---

[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)
