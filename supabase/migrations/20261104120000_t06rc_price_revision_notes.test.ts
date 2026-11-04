import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261104120000_t06rc_price_revision_notes.sql"),
  "utf8",
);

describe("T06 price revision notes migration", () => {
  it("adds a nullable column for the CEO's revision reason only", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS decision_notes TEXT;/);
    expect(migration).not.toMatch(/NOT NULL|DROP|UPDATE /);
  });
});
