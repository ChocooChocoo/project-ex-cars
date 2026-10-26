import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261026100000_t03_payment_proof_rejection.sql"),
  "utf8",
);

describe("T03 payment proof and rejection migration", () => {
  it("adds the proof photo path and the rejection fields to payment records", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS proof_path text/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth\.users\(id\)/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS rejected_at timestamptz/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS rejection_reason text/i);
  });

  it("never lets a payment be both verified and rejected", () => {
    expect(migration).toMatch(/CHECK \(verified_by IS NULL OR rejected_at IS NULL\)/i);
  });

  it("only adds", () => {
    expect(migration).not.toMatch(/DROP /i);
  });
});
