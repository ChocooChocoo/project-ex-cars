import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261027110000_t03_field_case_price_and_location.sql"),
  "utf8",
);

describe("T03 field case price status and location migration", () => {
  it("adds the price status and its amounts", () => {
    expect(migration).toMatch(/price_status TEXT CHECK \(price_status IN \('negotiated', 'displayed_price'\)\)/);
    expect(migration).toMatch(/updated_price NUMERIC CHECK \(updated_price > 0\)/);
    expect(migration).toMatch(/discount_amount NUMERIC CHECK \(discount_amount >= 0\)/);
  });

  it("adds the last known position with range checks", () => {
    expect(migration).toMatch(/last_lat DOUBLE PRECISION CHECK \(last_lat BETWEEN -90 AND 90\)/);
    expect(migration).toMatch(/last_lng DOUBLE PRECISION CHECK \(last_lng BETWEEN -180 AND 180\)/);
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS last_located_at TIMESTAMPTZ");
  });

  it("stops browser sessions from writing the new columns", () => {
    expect(migration).toMatch(/IF current_user IN \('anon', 'authenticated'\)/);
    expect(migration).toMatch(/NEW\.updated_price := OLD\.updated_price/);
    expect(migration).toMatch(/NEW\.last_lat := OLD\.last_lat/);
    expect(migration).toMatch(
      /CREATE TRIGGER guard_field_case_price_location\s+BEFORE INSERT OR UPDATE ON public\.field_cases/,
    );
  });
});
