import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261101130000_t05_vehicle_identifiers.sql"),
  "utf8",
);

describe("T05 vehicle identifiers migration", () => {
  it("adds the plate, engine and chassis numbers the Deed of Sale prints", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS plate_number TEXT/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS engine_number TEXT/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS chassis_number TEXT/);
  });

  it("touches the vehicles table only", () => {
    const altered = [...migration.matchAll(/ALTER TABLE\s+public\.(\w+)/g)].map((m) => m[1]);
    expect(altered).toContain("vehicles");
    expect(new Set(altered)).toEqual(new Set(["vehicles"]));
  });

  it("leaves the existing cars without identifiers", () => {
    expect(migration).not.toMatch(/(plate_number|engine_number|chassis_number)[^;]*NOT NULL/i);
    expect(migration).not.toMatch(/DEFAULT/i);
    expect(migration).not.toMatch(/\b(UPDATE|DELETE FROM)\b/i);
  });

  it("only adds columns", () => {
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN|POLICY)/i);
  });
});
