import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/00054_t01_phase5_financing.sql"), "utf8");

describe("T01 Phase 5 financing migration", () => {
  it("adds the Head Accountant review and a returned-for-revision state to the terms", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS duration_months INTEGER/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS ha_reviewed_by UUID/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS returned_reason TEXT/);
    expect(migration).toMatch(
      /state IN \('proposed', 'ha_approved', 'returned', 'approved', 'rejected', 'active', 'completed'\)/,
    );
  });

  it("flags missed payments and lets an account end as repossessed", () => {
    expect(migration).toMatch(/installment_accounts\s+ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ/);
    expect(migration).toMatch(/state IN \('active', 'closed', 'repossessed'\)/);
  });

  it("keeps one open reconditioning job per car, readable by vehicle staff only", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.reconditioning_jobs/);
    expect(migration).toMatch(/state IN \('awaiting_report', 'awaiting_funds', 'in_progress', 'completed'\)/);
    expect(migration).toMatch(/idx_reconditioning_jobs_open[\s\S]*\(vehicle_id\)[\s\S]*WHERE state <> 'completed'/);
    expect(migration).toMatch(/ALTER TABLE public\.reconditioning_jobs ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/ON public\.reconditioning_jobs FOR SELECT/);
    expect(migration).not.toMatch(/FOR (ALL|INSERT|UPDATE|DELETE)|DISABLE ROW LEVEL SECURITY/i);
  });
});
