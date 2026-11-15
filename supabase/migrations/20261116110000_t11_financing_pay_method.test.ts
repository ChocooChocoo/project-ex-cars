import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261116110000_t11_financing_pay_method.sql"),
  "utf8",
);

describe("T11 financing pay method", () => {
  it("adds the financing pay method with a cash or PayMongo choice", () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.purchase_details\s+ADD COLUMN IF NOT EXISTS financing_pay_method TEXT DEFAULT 'paymongo'/,
    );
    expect(migration).toMatch(/CHECK \(financing_pay_method IN \('cash', 'paymongo'\)\)/);
  });

  it("keeps the arrangement itself a financing one", () => {
    // payment_method stays 'financing'; financing_pay_method only says how the money moves.
    expect(migration).toMatch(/payment_method stays 'financing'/);
    expect(migration).not.toMatch(/DROP CONSTRAINT IF EXISTS purchase_details_payment_method_check/);
    expect(migration).not.toMatch(/ADD COLUMN IF NOT EXISTS payment_method/);
  });

  it("wraps the change in a transaction", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration).toMatch(/^COMMIT;$/m);
  });
});
