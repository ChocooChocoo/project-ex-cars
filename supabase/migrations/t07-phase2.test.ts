import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

describe("T07 phase 2 migrations", () => {
  it("restricts reviews to owning customers with completed transactions", () => {
    const sql = readFileSync("supabase/migrations/20261106110000_t07_customer_reviews.sql", "utf8");
    for (const fragment of [
      "ENABLE ROW LEVEL SECURITY",
      "FOR INSERT TO authenticated",
      "FOR SELECT TO authenticated",
      "current_state = 'completed'",
      "transaction_id UUID NOT NULL UNIQUE",
      "ON DELETE CASCADE",
      "rating BETWEEN 1 AND 5",
      "BETWEEN 1 AND 2000",
      "DEFAULT 'published'",
      "profiles(id)",
      "customer_reviews_vehicle_idx",
      "customer_reviews_created_idx",
    ])
      expect(sql).toContain(fragment);
  });
  it("persists location and explicit towing consent with nonblank checks", () => {
    const sql = readFileSync("supabase/migrations/20261106120000_t07_cancel_consent.sql", "utf8");
    for (const fragment of [
      "ADD COLUMN location TEXT",
      "cancellation_towing_ack_at",
      "cancellation_towing_ack_by",
      "purchase_details_location_required",
      "viewing_arrangements_location_required",
      "nullif(btrim(location), '') IS NOT NULL",
      "NOT VALID",
    ])
      expect(sql).toContain(fragment);
  });
});
