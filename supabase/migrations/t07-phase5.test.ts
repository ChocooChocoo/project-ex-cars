import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20261106140000_t07_towing_reconditioning.sql", "utf8");

describe("T07 towing and reconditioning schema", () => {
  it("protects parts, funds and private receipts", () => {
    for (const table of ["reconditioning_parts", "reconditioning_fund_requests", "reconditioning_fund_receipts"]) {
      expect(sql).toContain(`CREATE TABLE public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql).toContain("'reconditioning-receipts',false");
    expect(sql).not.toContain("funds_released_cents");
    expect(sql).toContain("disbursement_id uuid UNIQUE REFERENCES");
    expect(sql).toContain("refund_due_cents bigint");
  });
  it("limits new recovery policies to assigned active team members", () => {
    expect(sql).toContain("case_kind = 'recovery'");
    expect(sql).toContain("head_security_id = auth.uid()");
    expect(sql).toContain("assigned_confidential_informant = auth.uid()");
    expect(sql).toContain("mechanic_id = auth.uid()");
  });
});
