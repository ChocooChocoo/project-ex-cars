import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/00052_t01_phase4_delivery.sql"), "utf8");

function policyBlock(name: string) {
  return migration.match(new RegExp(`CREATE POLICY "${name}"([\\s\\S]*?);\\n`, "i"))?.[1] ?? "";
}

describe("T01 Phase 4 delivery migration", () => {
  it("tells delivery payments apart", () => {
    expect(migration).toMatch(/payment_kind IN \('full', 'delivery_fee', 'downpayment', 'balance', 'reschedule_fee'\)/);
  });

  it("lets the Sales Manager record, never verify, a buyer's payment", () => {
    const policy = policyBlock("Sales Manager can record buyer payments");
    expect(policy).toMatch(/FOR INSERT/);
    expect(policy).toMatch(/recorded_by = auth\.uid\(\)/);
    expect(policy).toMatch(/verified_by IS NULL/);
    expect(policy).toMatch(/installment_id IS NULL/);
    expect(policy).toMatch(/transaction_kind = 'buy'/);
    expect(policy).toMatch(/role = 'sales_manager'/);
  });

  it("stores delivery terms and the delivery team's tracking", () => {
    for (const column of [
      "delivery_serviceable BOOLEAN",
      "delivery_fee NUMERIC",
      "downpayment_amount NUMERIC",
      "downpayment_due_at TIMESTAMPTZ",
      "downpayment_forfeited_at TIMESTAMPTZ",
      "head_security_id UUID REFERENCES auth.users",
      "delay_note TEXT",
      "expected_arrival TIMESTAMPTZ",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toMatch(/delivery_status IN \('dispatched', 'in_transit', 'arriving', 'delivered'\)/);
  });

  it("lets Head Security read only the cases assigned to them", () => {
    const policy = policyBlock("Head Security can read assigned field cases");
    expect(policy).toMatch(/FOR SELECT/);
    expect(policy).toMatch(/head_security_id = auth\.uid\(\)/);
    expect(migration).toMatch(/worker\.role IN \('confidential_informant', 'mechanic', 'head_security'\)/);
    expect(migration).not.toMatch(/FOR ALL|FOR UPDATE|FOR DELETE|DISABLE ROW LEVEL SECURITY/i);
  });
});
