[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)

**Status:** 🔲 Not Started

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

## Tasks

- [ ] AM4: reproduce in the browser as the Account Manager (Playwright MCP) and capture the error (console, server log).
- [ ] AM4: find the root cause before changing code (systematic-debugging) and fix it; record cause and fix here.
- [ ] AM4: ask the client whether "Create a Walk-in" means a walk-in customer account or a walk-in transaction; if a
  transaction, add the UI for `createWalkInTransaction` as a follow-up task here.
- [ ] AM5: write a failing unit test in `src/app/(staff)/payroll/actions.test.ts` for a run with one employee
  (compensation set, 2 present days, 1 absent) expecting one payslip and the right total.
- [ ] AM5: read/write `staff_compensation` through `admin.schema("private")` (or a security-definer RPC if the schema is
  not exposed) in `actions.ts` and `page.tsx`.
- [ ] AM5: count only present days at `actions.ts:138`.
- [ ] AM5: return a clear error when a run for the same period exists (`uq_payroll_period`).
- [ ] AM5: fix the `revalidatePath` calls to the role-prefixed payroll path.

## Done when

- [ ] As the Account Manager, clicking "Create a Walk-in" opens the form, and submitting creates a customer account that
  can sign in.
- [ ] The new payroll unit test passes.
- [ ] As the Account Manager, Create Run for a new period makes a run with one payslip per employee with compensation,
  totals above ₱0, and the list refreshes without a reload.
- [ ] A second Create Run for the same period shows the duplicate-period message.
- [ ] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean.

---

[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)
