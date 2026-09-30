import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00053_t01_buy_arrangement_read.sql"),
  "utf8",
);

describe("T01 buy request arrangement read migration", () => {
  it("lets sales staff read only buy-request arrangements, read-only", () => {
    expect(migration).toMatch(/ON public\.viewing_arrangements FOR SELECT/);
    expect(migration).toMatch(/purchase_transaction_id IS NOT NULL/);
    expect(migration).toMatch(/transactions\.transaction_kind = 'buy'/);
    expect(migration).toMatch(/role IN \('sales_manager', 'head_accountant'\)/);
    expect(migration).not.toMatch(/FOR (ALL|INSERT|UPDATE|DELETE)|DISABLE ROW LEVEL SECURITY/i);
  });
});
