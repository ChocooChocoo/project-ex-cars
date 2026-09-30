import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/00050_t01_phase2_onsite_visit.sql"), "utf8");

describe("T01 Phase 2 onsite visit migration", () => {
  it("derives each arrangement's car on the server, never from the client", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public\.vehicles\(id\)/);
    const trigger =
      migration.match(/FUNCTION public\.set_arrangement_vehicle\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/)?.[1] ?? "";
    expect(trigger).toMatch(/NEW\.vehicle_id := COALESCE\(/);
    expect(trigger).toMatch(/transactions\.id = NEW\.purchase_transaction_id/);
    expect(trigger).toMatch(/inquiries\.id = NEW\.inquiry_id/);
    expect(migration).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE OF purchase_transaction_id, inquiry_id, vehicle_id/);
  });

  it("locks one live booking per car and time", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_viewing_arrangements_slot_lock[\s\S]*\(vehicle_id, schedule\)[\s\S]*WHERE confirmation_state IN \('pending', 'confirmed'\)/,
    );
    // Duplicates are cancelled (earliest booking kept) before the index is built.
    expect(migration.indexOf("SET confirmation_state = 'cancelled'")).toBeLessThan(
      migration.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS idx_viewing_arrangements_slot_lock"),
    );
  });

  it("shows taken times to signed-in users without saying who booked them", () => {
    const returns = migration.match(/list_taken_visit_slots\(p_vehicle_id UUID\)\s*RETURNS TABLE \(([^)]*)\)/)?.[1];
    expect(returns?.trim()).toBe("schedule TIMESTAMPTZ");
    expect(migration).toMatch(/auth\.uid\(\) IS NOT NULL/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.list_taken_visit_slots\(UUID\) FROM anon;/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.list_taken_visit_slots\(UUID\) TO authenticated;/);
  });

  it("adds no policies", () => {
    expect(migration).not.toMatch(/CREATE POLICY|ALTER POLICY|DISABLE ROW LEVEL SECURITY/i);
  });
});
