[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)

**Status:** 🟡 In progress

# Phase 5: Overtime request by date and hours

**Goal:** An overtime request is one Date and a number of hours, with no reason. Payroll pays at most the approved
hours.

Source: the client's answer on batch 2 test 13:
- "sa overtime sir mawawala po yung end date tapos yung sa 'Start Date' magiging date nalang po sir": remove End
  Date and rename "Start Date" to "Date".
- "imbis na 'End date' ... kung ilang oras po siya mag rerequest ng overtime para sa date po na sinet niya":
  instead of an end date, enter the overtime hours for that date.
- "sa overtime request sir wala na pong reason": no reason field.

How payroll works today:
- `src/app/(staff)/payroll/actions.ts:159-164` reads approved overtime as date ranges.
- `src/lib/payroll/compute.ts:57-68` pays every worked minute past the schedule on those dates. Nothing caps it.

Default chosen for this plan: payroll pays the smaller of the actual extra time and the approved hours.

## Dependencies

- Phase 4, which makes `reason` nullable and adds the request discriminated union.

## Tasks

- [x] Migration `supabase/migrations/<timestamp>_t06_overtime_hours.sql` (+ `.test.ts`):
  - Add `employee_requests.overtime_hours numeric(4,2)`.
  - Add a CHECK, marked `NOT VALID` so legacy rows stay valid. A new `overtime` row must have `overtime_hours`
    between 0.5 and 12, and `end_date IS NULL`.
- [x] `src/lib/validation/phase6.ts`, overtime branch:
  - Required: `start_date` (shown as "Date") and `overtime_hours`.
  - Not allowed: `reason` and `end_date`.
  - Write the tests first.
- [x] `employee-requests-client.tsx`:
  - For Overtime, show "Date" and "Hours" (step 0.5). Hide End Date and Reason.
  - In the table, show the hours (for example "2 h") in place of End for overtime rows.
- [x] Payroll:
  - `payroll/actions.ts:159-164`: also select `overtime_hours`.
  - `compute.ts:57-68`: change `OvertimeRange` to carry the hours. Overtime minutes = `min(worked − scheduled, hours × 60)`.
  - A legacy row with null hours keeps the old uncapped rule.
  - Add the tests in `src/lib/payroll/compute.test.ts` first.

## Done when

- [x] Compute tests cover three cases: worked more than approved (capped), worked less than approved, and a legacy
  row (uncapped).
- [ ] Playwright MCP:
  - Send an overtime request with a Date and 2 hours.
  - The Account Manager approves it.
  - The payslip's Overtime hours line is at most 2.00 h.
  - Live QA deferred to the main agent.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.
  - `npx tsc --noEmit` is clean. Targeted `npx vitest run` on the seven touched suites passes. `check:fix`, the full
    suite and `build` are reserved for the main agent, per the subagent contract.

## Status notes (2026-10-31)

- Migration `supabase/migrations/20261031140000_t06_overtime_hours.sql`: adds `overtime_hours NUMERIC(4,2)` and a
  `NOT VALID` check so a new overtime row needs 0.5–12 hours and `end_date IS NULL`. The phase 4 migration is
  unchanged.
  - Legacy overtime rows keep `overtime_hours = NULL` on purpose, so payroll still pays them uncapped. A `NOT VALID`
    check is still enforced on updates: approving or cancelling a legacy overtime row that has no hours would fail
    the check. The plan does not name a backfill, so none was added; decide later if legacy pending rows need one.
- `src/lib/validation/phase6.ts`: the overtime branch requires `start_date` ("Date is required.") and coerces
  `overtime_hours` (0.5–12). It has no `reason` or `end_date`, so Zod strips both. Leave, schedule change and other
  branches are unchanged.
- `src/app/(staff)/employee-requests/actions.ts`: inserts `overtime_hours`, forces `end_date` and `reason` to null for
  overtime, and leaves leave/schedule/other behaviour intact.
- Request dialog: overtime shows Date and Hours (`type="number"`, step 0.5, min 0.5, max 12, described by
  "Between 0.5 and 12 hours, in 0.5 steps"), hides End Date, Leave reason and Reason, and submits clean fields. The
  review dialog shows the date and approved hours.
- Requests table: `overtime_hours` flows through `page.tsx` into the row type. The "End / Hours" column prints
  "2 h" for overtime rows and still prints the end date otherwise; hours join the search text.
- Payroll: `payroll/actions.ts` selects `overtime_hours`; `compute.ts` caps each overtime day at
  `min(worked − scheduled, hours × 60)` minutes. Null hours keep the legacy uncapped rule.
- Commands: `npx vitest run "supabase/migrations/20261031140000_t06_overtime_hours.test.ts"
  "src/lib/validation/phase6.test.ts" "src/lib/payroll/compute.test.ts" "src/app/(staff)/employee-requests"
  "src/app/(staff)/payroll/actions.test.ts"` — 7 files, 65 tests passed (run again after formatting).
  `npx biome check` on the 13 touched files is clean. `npx tsc --noEmit` reports no errors.
- Assumption: when one date matches more than one approval, a null-hours legacy row keeps the day uncapped; otherwise
  the caps add up.
- Assumption: `overtime_hours` is not restricted to 0.5 increments in the database or Zod, matching the plan's
  0.5–12 bound; the number input uses `step=0.5` as a UI hint.

---

## Live QA (2026-10-31, main agent)

- `mechanic3@gce.local` filed an Overtime request: the dialog shows only Date and Hours (number, step 0.5, min 0.5,
  max 12). End Date and Reason are gone. Submit returned "Request submitted.".
- The stored row is `request_kind = overtime`, `start_date = 2026-11-02`, `overtime_hours = 2.00`,
  `end_date = null`, `reason = null`.
- `account_manager@gce.local` reviewed it: the dialog shows Date and "Hours 2 h", no proof files, and Approve returned
  "Request approved.".
- The request table shows "2 h" in the End / Hours column for overtime rows.
- Not live-tested: the payslip Overtime hours line. It needs a payroll run for a period that contains the approved
  date; the cap itself is covered by `compute.test.ts`.

---

[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)
