import { describe, expect, it } from "vitest";

import { ID_SIDES } from "@/lib/transactions/buy-flow";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261030100000_t05_id_side.sql"), "utf8");

describe("T05 ID side migration", () => {
  it("adds a nullable side limited to front and back", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS id_side TEXT CHECK \(id_side IN \('front', 'back'\)\)/);
  });

  it("offers the sides the app knows", () => {
    const sides = migration.match(/id_side IN \(([^)]*)\)/)?.[1] ?? "";
    expect([...sides.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort()).toEqual([...ID_SIDES].sort());
  });

  it("leaves old rows without a side on the old two-ID rule", () => {
    expect(migration).not.toMatch(/id_side[^;]*NOT NULL/i);
    expect(migration).not.toMatch(/\b(UPDATE|DELETE FROM)\b/i);
  });

  it("only adds a column", () => {
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN|POLICY)/i);
  });
});
