import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261116100000_t11_field_case_assignment_rls.sql"),
  "utf8",
);

// Everything from the recreated worker UPDATE policy up to the staff read policy, so the negative assertions
// below cannot be satisfied by text that belongs to a different policy.
const workerUpdatePolicy = migration.slice(
  migration.indexOf('CREATE POLICY "Field workers can update field cases"'),
  migration.indexOf('DROP POLICY IF EXISTS "Staff can read field cases"'),
);

const staffReadPolicy = migration.slice(
  migration.indexOf('CREATE POLICY "Staff can read field cases"'),
  migration.indexOf("CREATE OR REPLACE FUNCTION public.guard_field_case_assignment"),
);

const trigger = migration.slice(migration.indexOf("CREATE TRIGGER guard_field_case_assignment"));

describe("T11 field case assignment RLS", () => {
  it("wraps the policy and trigger changes in a transaction", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration).toMatch(/^COMMIT;$/m);
  });

  it("replaces the 00042 role-only UPDATE policy instead of adding a second one", () => {
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Field workers can update field cases" ON public\.field_cases;/);
    expect(workerUpdatePolicy).toMatch(/ON public\.field_cases FOR UPDATE/);
  });

  it("limits the worker UPDATE to cases assigned to that worker", () => {
    expect(workerUpdatePolicy).toMatch(/role IN \('confidential_informant', 'mechanic'\)/);
    expect(workerUpdatePolicy).toMatch(/auth\.uid\(\) IN \(assigned_confidential_informant, mechanic_id\)/);
  });

  it("checks the assignment on the new row too, so a worker cannot reassign the case", () => {
    // USING alone would let an assigned worker update a row into a case that is no longer theirs.
    expect(workerUpdatePolicy).toMatch(/WITH CHECK \(\s*EXISTS \(/);
    expect(workerUpdatePolicy.match(/auth\.uid\(\) IN \(assigned_confidential_informant, mechanic_id\)/g)).toHaveLength(
      2,
    );
  });

  it("keeps the office roles reading every case and scopes each field role to its own cases", () => {
    expect(staffReadPolicy).toMatch(/ON public\.field_cases FOR SELECT/);
    expect(staffReadPolicy).toMatch(/role IN \('ceo', 'sales_manager', 'head_accountant'\)/);
    expect(staffReadPolicy).toMatch(
      /role = 'confidential_informant'\s*\)\s*AND assigned_confidential_informant = auth\.uid\(\)/,
    );
    expect(staffReadPolicy).toMatch(/role = 'mechanic'\s*\)\s*AND mechanic_id = auth\.uid\(\)/);
  });

  it("restores the assignment columns from OLD for browser sessions", () => {
    expect(migration).toMatch(/IF current_user IN \('anon', 'authenticated'\) AND TG_OP = 'UPDATE' THEN/);
    expect(migration).toMatch(/NEW\.assigned_confidential_informant := OLD\.assigned_confidential_informant;/);
    expect(migration).toMatch(/NEW\.head_security_id := OLD\.head_security_id;/);
    expect(migration).toMatch(/NEW\.case_kind := OLD\.case_kind;/);
  });

  it("guards UPDATE only, so field case creation keeps working", () => {
    expect(trigger).toMatch(/CREATE TRIGGER guard_field_case_assignment/);
    expect(trigger).toMatch(/BEFORE UPDATE ON public\.field_cases/);
    expect(trigger).toMatch(/FOR EACH ROW EXECUTE FUNCTION public\.guard_field_case_assignment\(\);/);
    // An INSERT guard would break createFieldCase, openMeetupCase and the recovery inserts.
    expect(trigger).not.toMatch(/INSERT/);
    expect(migration).not.toMatch(/TG_OP = 'INSERT'/);
  });

  it("leaves the other field case policies alone", () => {
    expect(migration).not.toMatch(/DROP POLICY IF EXISTS "Field workers can create field cases"/);
    expect(migration).not.toMatch(/DROP POLICY IF EXISTS "Staff can manage field cases"/);
    expect(migration).not.toMatch(/DROP POLICY IF EXISTS "Assigned recovery team/);
  });
});
