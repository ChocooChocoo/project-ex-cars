[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)

**Status:** ✅ Done

Completed 2026-10-26.

# Phase 7: Account Manager — Walk-in and Payroll Create Run

**Goal:** "Create a Walk-in" in the Account Manager sidebar works (AM4), and Payroll "Create Run" produces a run with
payslips and correct totals (AM5).

## Dependencies

- Phase 2 complete (final Account Manager access).

## Background

- Walk-in: nav item `src/navigation/sidebar/sidebar-items.ts:218-223` → `/staff-records?createWalkIn=1`;
  `staff-records/page.tsx:81` renders `<WalkInForm initialOpen>`; form `walk-in-form.tsx:23-53` calls
  `createWalkInAccount` (`src/app/auth/actions.ts:196-246`, needs `SUPABASE_SERVICE_ROLE_KEY`). The code path looks wired;
  the failure is not yet reproduced. `createWalkInTransaction` (`transactions/actions.ts:925`) has no UI.
- Payroll: button `payroll/_components/payroll-client.tsx:160` → `createPayrollRun` (`payroll/actions.ts:88-225`).
  Likely cause: `staff_compensation` is in the `private` schema (`00017_phase6_payroll.sql:5`) but the code uses
  `admin.from("staff_compensation")` (`actions.ts:39,127`, `payroll/page.tsx:33`), which targets `public`.
  Other issues: `uq_payroll_period` blocks a second run per period; `:138` counts `absent`/`on_leave` as worked;
  `revalidatePath("/dashboard/payroll")` points at the old path.

## Decisions (2026-10-26)

- "Create a Walk-in" means a walk-in **customer account** (owner's answer). No UI for `createWalkInTransaction`.

## Tasks

- [x] AM4: reproduce in the browser as the Account Manager (Playwright MCP) and capture the error (console, server log).
  Not reproduced: sidebar "Create Walk-In" opens the dialog, submit closes it with 0 console errors, and the new
  account signs in to `/customer/showroom`.
- [x] AM4: find the root cause before changing code (systematic-debugging) and fix it; record cause and fix here.
  No failure left to fix. The likely earlier cause was the role guard Phase 2 already changed (`createWalkInAccount`
  and the walk-in nav/page for `account_manager` + `ceo`). No AM4 code change in this phase.
- [x] AM4: ask the client whether "Create a Walk-in" means a walk-in customer account or a walk-in transaction; if a
  transaction, add the UI for `createWalkInTransaction` as a follow-up task here. Answer: customer account.
- [x] AM5: write a failing unit test in `src/app/(staff)/payroll/actions.test.ts` for a run with one employee
  (compensation set, 2 present days, 1 absent) expecting one payslip and the right total. Failed first (the action
  called the admin client for `staff_compensation`), passes now. Also covers late / half day / on leave, an employee
  with no worked days, and the duplicate period.
- [x] AM5: read/write `staff_compensation` through `admin.schema("private")` (or a security-definer RPC if the schema is
  not exposed) in `actions.ts` and `page.tsx`. The `private` schema is not exposed (`supabase/config.toml` lists only
  `public`, `graphql_public`), so: migration `supabase/migrations/20261026110000_t03_staff_compensation_rpc.sql` adds
  `list_staff_compensation(p_period_start, p_period_end)` (CEO / Account Manager / Head Accountant) and
  `add_staff_compensation(...)` (CEO / Account Manager, `created_by = auth.uid()`), both SECURITY DEFINER, not callable
  by `anon`. `actions.ts` and `page.tsx` call them with the user's client; the admin client is gone from payroll.
  `CompensationRow` now has a flat `full_name`. Applied to the hosted project with `npx supabase db push` (run by the owner, 2026-10-26).
- [x] AM5: count only present days at `actions.ts:138`. `PAID_DAYS`: present 1, late 1, half day 0.5; absent and on
  leave 0. An employee with 0 paid days gets no payslip.
- [x] AM5: return a clear error when a run for the same period exists (`uq_payroll_period`). Postgres code `23505` on
  the run insert returns "A payroll run for this period already exists."
- [x] AM5: fix the `revalidatePath` calls to the role-prefixed payroll path. `revalidatePayroll(role, page)` refreshes
  `/payroll` and `rolePath(role, "/payroll")` (same for payslips) in every payroll action.

## Done when

- [x] As the Account Manager, clicking "Create a Walk-in" opens the form, and submitting creates a customer account that
  can sign in.
- [x] The new payroll unit test passes.
- [x] As the Account Manager, Create Run for a new period makes a run with one payslip per employee with compensation,
  totals above ₱0, and the list refreshes without a reload.
- [x] A second Create Run for the same period shows the duplicate-period message.
- [x] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean.

## Verification (2026-10-26)

| Check | Result |
| --- | --- |
| New tests before the change | `payroll/actions.test.ts` 4 failed ("NEXT_PUBLIC_SUPABASE_URL is not set" from the admin client) |
| `npm run test` | 83 files, 539 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on touched files | clean |
| `npm run build` | compiled, exit 0 |
| Hosted migration | `20261026110000_t03_staff_compensation_rpc.sql` applied (owner ran `npx supabase db push`) |
| Walk-in (MCP, Account Manager) | sidebar link opens "Create Walk-in Account"; created "E2E Walkin Phase Seven" (`e2e.walkin.p7@gce.local`); dialog closes, 0 console errors |
| Walk-in sign-in (MCP) | new account signs in and lands on `/customer/showroom` |
| Compensation list (MCP) | 8 seeded records now show (empty before: the table was unreachable) |
| Create Run (MCP) | period 2026-07-01 to 2026-07-31: row appears without reload, Gross ₱29,400.03, Deductions ₱0, Net ₱29,400.03 |
| Run in DB | 6 payslips, gross 2,940,003 cents, 6 items; matches a SQL check of paid days × (base / 30), absent days left out |
| Duplicate (MCP) | same period again: "A payroll run for this period already exists." in the dialog |
| Console errors (MCP) | 0 |
| Rerun after the label fix | `tsc` exit 0; full suite 536/539 with 3 timeouts in `employee-requests` / `staff-records` table tests under load; those files plus payroll rerun alone: 51/51 |

## Files changed

- `src/app/(staff)/payroll/actions.ts`, `page.tsx`, `_components/payroll-tables.tsx`, `_components/payroll-client.tsx`,
  `_components/payroll-client.test.tsx`
- `src/app/(staff)/payroll/actions.test.ts` (new)
- `supabase/migrations/20261026110000_t03_staff_compensation_rpc.sql` (new), `.test.ts` (new)

## Blockers

- None.

## Notes and assumptions

- "Count only present days" read as days worked: `late` counts as a full day (the employee worked), `half_day` as half.
- Found during the walk: the Create Run date and notes fields had no accessible names (labels not tied to inputs).
  Added `id`/`htmlFor`, and the dialog error now has `role="alert"`. Checked live: fields read "Period Start" /
  "Period End".
- Test data added to the hosted database: walk-in customer `e2e.walkin.p7@gce.local` and a draft payroll run for
  2026-07-01 to 2026-07-31 (note "E2E phase 7 live check").
- The older runs on the list (all ₱0) were made while the bug was live; they were left as they are.
- Compensation records are ordered by `effective_from`, so when two overlap a period the latest one is used.

---

[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)
