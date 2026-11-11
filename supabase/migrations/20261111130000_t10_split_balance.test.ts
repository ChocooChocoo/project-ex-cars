import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261111130000_t10_split_balance.sql"),
  "utf8",
);

describe("T10 split balance migration", () => {
  it("numbers each part of a payment", () => {
    expect(migration).toMatch(/part_no SMALLINT NOT NULL DEFAULT 1 CHECK \(part_no >= 1\)/);
  });

  it("keeps one live row per kind and part", () => {
    expect(migration).toMatch(/ON public\.payment_records \(transaction_id, payment_kind, part_no\)/);
    expect(migration).toMatch(/rejected_at IS NULL/);
  });
});
