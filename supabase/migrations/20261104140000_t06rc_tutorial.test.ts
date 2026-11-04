import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261104140000_t06rc_tutorial.sql"), "utf8");

describe("T06 tutorial migration", () => {
  it("adds the completion time and marks existing accounts as done", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS tutorial_completed_at TIMESTAMPTZ;/);
    expect(migration).toMatch(
      /UPDATE public\.profiles SET tutorial_completed_at = now\(\) WHERE tutorial_completed_at IS NULL;/,
    );
  });
});
