import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00051_t01_phase3_halfway_queue.sql"),
  "utf8",
);
const guard = migration.match(/FUNCTION public\.guard_transaction_end\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/)?.[1] ?? "";

describe("T01 Phase 3 halfway queue migration", () => {
  it("allows one Active request per car", () => {
    expect(migration).toMatch(/queue_state TEXT CHECK \(queue_state IN \('active', 'on_hold'\)\)/);
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_one_active_request[\s\S]*\(vehicle_id\)[\s\S]*WHERE queue_state = 'active'/,
    );
  });

  it("takes an ended request out of the queue", () => {
    expect(guard).toMatch(
      /IF NEW\.current_state IN \('rejected', 'completed', 'cancelled'\) THEN\s+NEW\.queue_state := NULL;/,
    );
    expect(migration).toMatch(/BEFORE UPDATE OF current_state, queue_state ON public\.transactions/);
  });

  it("refuses a customer's own cancellation inside 5 hours of a meet-up or delivery", () => {
    expect(guard).toMatch(/auth\.uid\(\) = NEW\.customer_id/);
    expect(guard).toMatch(/arrangement_kind IN \('meetup', 'delivery'\)/);
    expect(guard).toMatch(/arrangement\.schedule < now\(\) \+ interval '5 hours'/);
    expect(guard).toMatch(/RAISE EXCEPTION/);
    expect(migration).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
  });

  it("adds the acknowledgment and the buyer meet-up field case kind", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS condition_acknowledged_at TIMESTAMPTZ/);
    expect(migration).toMatch(/case_kind IN \('acquisition', 'delivery', 'recovery', 'sourcing', 'buyer_meetup'\)/);
  });

  it("keeps the slot lock and taken-slot list to GCE visits", () => {
    expect(migration).toMatch(
      /idx_viewing_arrangements_slot_lock[\s\S]*WHERE confirmation_state IN \('pending', 'confirmed'\) AND arrangement_kind = 'gce_visit'/,
    );
    expect(migration).toMatch(/arrangement\.arrangement_kind = 'gce_visit'[\s\S]*auth\.uid\(\) IS NOT NULL/);
    expect(migration).not.toMatch(/CREATE POLICY|DISABLE ROW LEVEL SECURITY/i);
  });
});
