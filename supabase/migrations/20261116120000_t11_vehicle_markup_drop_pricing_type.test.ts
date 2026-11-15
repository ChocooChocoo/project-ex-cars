import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261116120000_t11_vehicle_markup_drop_pricing_type.sql"),
  "utf8",
);

describe("T11 vehicle markup and dropped pricing type", () => {
  it("adds a per-car financing markup with a range check", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS financing_markup_pct NUMERIC\(5,2\)/);
    expect(migration).toMatch(/CHECK \(financing_markup_pct IS NULL OR financing_markup_pct BETWEEN 0 AND 100\)/);
  });

  it("documents that NULL falls back to the global rate", () => {
    expect(migration).toMatch(/app_settings\.financing_markup_pct/);
  });

  it("drops the pricing type constraint before the column it guards", () => {
    const dropConstraint = migration.indexOf("DROP CONSTRAINT IF EXISTS vehicles_pricing_type_check");
    const dropColumn = migration.indexOf("DROP COLUMN IF EXISTS pricing_type");
    expect(dropConstraint).toBeGreaterThan(-1);
    expect(dropColumn).toBeGreaterThan(dropConstraint);
    expect(migration).toMatch(/ALTER TABLE public\.vehicles DROP COLUMN IF EXISTS pricing_type;/);
  });

  it("wraps the change in a transaction", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration).toMatch(/^COMMIT;$/m);
  });
});
