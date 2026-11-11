import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261111120000_t10_customer_reschedule.sql"),
  "utf8",
);

describe("T10 customer reschedule migration", () => {
  it("keeps a paid re-schedule's new time and address until the fee is verified", () => {
    expect(migration).toMatch(/reschedule_pending_at TIMESTAMPTZ/);
    expect(migration).toMatch(/reschedule_pending_location TEXT/);
  });
});
