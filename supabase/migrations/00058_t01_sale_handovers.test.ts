import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/00058_t01_sale_handovers.sql"), "utf8");

describe("T01 sale handovers migration", () => {
  it("keeps one handover row per buy request with the papers custody states", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.sale_handovers/);
    expect(migration).toMatch(
      /transaction_id UUID PRIMARY KEY REFERENCES public\.transactions\(id\) ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /papers_status IN \('requested', 'released_to_ci', 'handed_over', 'received', 'returned'\)/,
    );
  });

  it("carries the contract states and the signing records", () => {
    expect(migration).toMatch(/contract_state IN \('draft', 'pending_approval', 'returned', 'approved', 'signed'\)/);
    for (const column of [
      "ci_copy_at",
      "mechanic_copy_at",
      "signing_reported_at",
      "buyer_met_at",
      "cash_reported_at",
    ]) {
      expect(migration).toMatch(new RegExp(`${column} TIMESTAMPTZ`));
    }
  });

  it("is readable by the buyer and sales staff and writable by nobody under RLS", () => {
    expect(migration).toMatch(/ALTER TABLE public\.sale_handovers ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/ON public\.sale_handovers FOR SELECT/);
    expect(migration).toMatch(/transactions\.customer_id = auth\.uid\(\)/);
    expect(migration).toMatch(/role IN \('ceo', 'sales_manager', 'head_accountant', 'account_manager'\)/);
    expect(migration).not.toMatch(/FOR (ALL|INSERT|UPDATE|DELETE)|DISABLE ROW LEVEL SECURITY/i);
  });

  it("lets the assigned team acknowledge a field case", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS ci_received_at TIMESTAMPTZ/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS mechanic_received_at TIMESTAMPTZ/);
  });
});
