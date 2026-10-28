import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261028120000_profile_avatar.sql"), "utf8");

describe("profile avatar migration", () => {
  it("adds the avatar column", () => {
    expect(migration).toMatch(/ALTER TABLE public\.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT/);
  });

  it("creates a public 2 MB image-only bucket", () => {
    expect(migration).toMatch(
      /VALUES \('avatars', 'avatars', true, 2097152, ARRAY\['image\/jpeg', 'image\/png', 'image\/webp'\]\)/,
    );
  });

  it("limits every write to the user's own folder", () => {
    const policies = [...migration.matchAll(/CREATE POLICY "[^"]+"\s+ON storage\.objects FOR (\w+)([\s\S]*?);/g)];
    expect(policies.map((p) => p[1]).sort()).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
    for (const [, , body] of policies) {
      const ownFolder = "bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text";
      expect(body).toContain(ownFolder);
      expect(body).toContain("TO authenticated");
    }
  });

  it("drops nothing but its own policies", () => {
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)/i);
  });
});
