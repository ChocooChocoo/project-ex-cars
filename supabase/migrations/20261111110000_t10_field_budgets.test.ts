import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261111110000_t10_field_budgets.sql"),
  "utf8",
);

describe("T10 field budgets migration", () => {
  it("links a budget to its field case and records the returned excess", () => {
    expect(migration).toMatch(/field_case_id UUID REFERENCES public\.field_cases\(id\)/);
    expect(migration).toMatch(/returned_cents BIGINT CHECK \(returned_cents IS NULL OR returned_cents >= 0\)/);
    expect(migration).toMatch(/return_confirmed_at TIMESTAMPTZ/);
  });

  it("allows one live budget per field case", () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_disbursement_requests_live_field_budget/);
    expect(migration).toMatch(/status <> 'rejected'/);
  });
});
