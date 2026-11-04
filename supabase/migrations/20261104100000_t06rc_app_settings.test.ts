import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261104100000_t06rc_app_settings.sql"),
  "utf8",
);

describe("T06 app settings migration", () => {
  it("seeds GCE's original 10% financing profit without overwriting a changed value", () => {
    expect(migration).toMatch(/'financing_markup_pct', '10'::jsonb/);
    expect(migration).toMatch(/ON CONFLICT \(key\) DO NOTHING/);
  });

  it("lets only the CEO and the Super Admin change settings", () => {
    expect(migration).toMatch(/FOR UPDATE[\s\S]*ur\.role IN \('ceo', 'super_admin'\)/);
    expect(migration).not.toMatch(/FOR (INSERT|DELETE|ALL)/);
  });
});
