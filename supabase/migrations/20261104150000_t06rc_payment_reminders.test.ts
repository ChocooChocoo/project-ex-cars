import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261104150000_t06rc_payment_reminders.sql"),
  "utf8",
);

describe("T06 payment reminders migration", () => {
  it("records each reminder once per installment and window", () => {
    expect(migration).toMatch(/PRIMARY KEY \(installment_id, days_before\)/);
    expect(migration).toMatch(/CHECK \(days_before IN \(7, 3, 1\)\)/);
  });

  it("locks the table to the service role", () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migration).not.toMatch(/CREATE POLICY/);
  });
});
