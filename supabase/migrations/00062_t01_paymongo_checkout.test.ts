import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/00062_t01_paymongo_checkout.sql"), "utf8");

describe("T01 PayMongo Checkout migration", () => {
  it("adds the checkout session, the PayMongo payment and the paid time to payment records", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS paymongo_checkout_id text/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS paymongo_payment_id text/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS paid_at timestamptz/);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS payment_records_paymongo_checkout_id_idx/);
  });

  it("only adds", () => {
    expect(migration).not.toMatch(/DROP /i);
  });
});
