import { describe, expect, it } from "vitest";

import { VEHICLE_MEDIA_KINDS } from "@/lib/vehicles/media-kinds";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261029100000_t04_vehicle_media_interior.sql"),
  "utf8",
);

describe("T04 vehicle media interior migration", () => {
  it("replaces the media kind check with one that allows interior", () => {
    const drop = migration.indexOf("DROP CONSTRAINT IF EXISTS vehicle_media_media_kind_check");
    const add = migration.indexOf("ADD CONSTRAINT vehicle_media_media_kind_check");
    expect(drop).toBeGreaterThan(-1);
    expect(add).toBeGreaterThan(drop);
    expect(migration).toMatch(/CHECK \(media_kind IN \('photo', '360_view', 'interior'\)\)/);
  });

  it("matches the media kinds the app accepts", () => {
    const kinds = migration.match(/CHECK \(media_kind IN \(([^)]*)\)\)/)?.[1] ?? "";
    expect([...kinds.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort()).toEqual([...VEHICLE_MEDIA_KINDS].sort());
  });

  it("only replaces the constraint", () => {
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN|POLICY)/i);
    expect(migration).not.toMatch(/\b(UPDATE|DELETE FROM)\b/i);
  });
});
