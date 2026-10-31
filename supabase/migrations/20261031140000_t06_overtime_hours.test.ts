import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261031140000_t06_overtime_hours.sql"),
  "utf8",
);

describe("T06 overtime hours migration", () => {
  it("adds the approved overtime hours column", () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.employee_requests\s+ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC\(4,2\)/,
    );
  });

  it("requires a new overtime row to state 0.5 to 12 hours on one date", () => {
    const constraint = migration.slice(migration.indexOf("chk_employee_request_overtime_hours"));

    expect(constraint).toMatch(/CHECK \(/);
    expect(constraint).toMatch(/request_kind <> 'overtime'/);
    expect(constraint).toMatch(/overtime_hours IS NOT NULL/);
    expect(constraint).toMatch(/overtime_hours >= 0\.5/);
    expect(constraint).toMatch(/overtime_hours <= 12/);
    expect(constraint).toMatch(/end_date IS NULL/);
  });

  it("keeps the check NOT VALID so legacy rows stay valid", () => {
    expect(migration).toMatch(/chk_employee_request_overtime_hours[\s\S]*\) NOT VALID/);
    expect(migration).not.toMatch(/VALIDATE CONSTRAINT chk_employee_request_overtime_hours/);
  });
});
