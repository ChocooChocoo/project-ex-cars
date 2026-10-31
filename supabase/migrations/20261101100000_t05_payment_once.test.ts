import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261101100000_t05_payment_once.sql"),
  "utf8",
);

describe("T05 payment once migration", () => {
  it("allows one live row per transaction and payment kind", () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_once_per_kind/);
    expect(migration).toMatch(/ON public\.payment_records \(transaction_id, payment_kind\)/);
  });

  it("frees the kind again when the Head Accountant rejects the payment", () => {
    expect(migration).toMatch(/WHERE installment_id IS NULL/);
    expect(migration).toMatch(/AND rejected_at IS NULL/);
  });

  it("keeps installment rows and the reschedule fee out of the rule", () => {
    expect(migration).toMatch(/AND payment_kind <> 'reschedule_fee'/);
  });

  it("changes no rows and drops nothing", () => {
    expect(migration).not.toMatch(/\b(DELETE|UPDATE|DROP|ALTER)\b/i);
  });
});
