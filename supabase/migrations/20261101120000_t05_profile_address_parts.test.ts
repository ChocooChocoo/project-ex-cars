import { describe, expect, it } from "vitest";

import { emptyAddressValue } from "@/lib/psgc/address";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261101120000_t05_profile_address_parts.sql"),
  "utf8",
);

const columns = [...migration.matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)].map((match) => match[1]);

describe("T05 profile address parts migration", () => {
  it("adds the block/lot line and the four PSGC codes", () => {
    const appColumns = Object.keys(emptyAddressValue()).filter(
      (key) => key === "address_line" || key.endsWith("_code"),
    );

    expect([...columns].sort()).toEqual([...appColumns].sort());
  });

  it("keeps the composed address column for autofill and delivery", () => {
    expect(migration).not.toMatch(/DROP COLUMN/i);
    expect(migration).not.toMatch(/ALTER COLUMN address\b/i);
    expect(migration).not.toMatch(/RENAME COLUMN address/i);
    expect(migration).not.toMatch(/UPDATE public\.profiles/i);
  });

  it("caps the block and lot line at 200 characters", () => {
    expect(migration).toMatch(/chk_profiles_address_line_length/);
    expect(migration).toMatch(/address_line IS NULL OR char_length\(address_line\) <= 200/);
  });

  it("accepts only nine-digit PSGC codes, or no code", () => {
    const check = migration.slice(migration.indexOf("chk_profiles_psgc_codes"));

    expect(check).toMatch(/CHECK \(/);
    for (const column of ["region_code", "province_code", "city_code", "barangay_code"]) {
      expect(check).toMatch(new RegExp(`${column} IS NULL OR ${column} ~ '\\^\\[0-9\\]\\{9\\}\\$'`));
    }
  });

  it("does not tighten the columns for rows saved before T05", () => {
    expect(migration).not.toMatch(/SET NOT NULL/i);
    expect(migration).not.toMatch(/NOT NULL,/);
    expect(migration).not.toMatch(/DEFAULT '/);
  });
});
