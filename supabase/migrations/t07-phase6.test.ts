import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261106160000_t07_payroll_rls.sql"), "utf8");

describe("T07 payroll RLS", () => {
  it("lets the Head Accountant update runs and payslips", () => {
    expect(sql).toContain("Head accountant updates payroll runs");
    expect(sql).toContain("Head accountant updates payslips");
    expect(sql).toMatch(/role = 'head_accountant'/);
  });
});
