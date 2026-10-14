import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00061_t01_paymongo_payment_method.sql"),
  "utf8",
);

describe("T01 PayMongo payment method migration", () => {
  it("keeps every existing method and adds paymongo", () => {
    expect(migration).toMatch(/CHECK \(method IN \('cash', 'financing', 'cheque', 'bank_transfer', 'paymongo'\)\)/);
  });

  it("only replaces the method constraint", () => {
    expect(migration).toMatch(/DROP CONSTRAINT IF EXISTS payment_records_method_check/);
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN|POLICY)/i);
  });
});
