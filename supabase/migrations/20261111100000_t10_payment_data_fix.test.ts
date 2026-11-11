import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261111100000_t10_payment_data_fix.sql"),
  "utf8",
);

describe("T10 payment data fix migration", () => {
  it("removes only unpaid, unreviewed PayMongo sessions older than a day", () => {
    expect(migration).toMatch(/paymongo_payment_id IS NULL/);
    expect(migration).toMatch(/paid_at IS NULL/);
    expect(migration).toMatch(/verified_by IS NULL/);
    expect(migration).toMatch(/rejected_at IS NULL/);
    expect(migration).toMatch(/interval '1 day'/);
  });

  it("reserves only available cars held by an approved buyer", () => {
    expect(migration).toMatch(/SET listing_state = 'reserved'/);
    expect(migration).toMatch(/v\.listing_state = 'available'/);
    expect(migration).toMatch(/'financing_active'/);
  });
});
