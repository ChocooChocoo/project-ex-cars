import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261111150000_t10_seller_paid_by_requester.sql"),
  "utf8",
);

describe("T10 seller paid by the fund requester", () => {
  it("lets the requester or the Head Accountant record the seller paid", () => {
    expect(migration).toMatch(/NOT v_head_accountant AND v_request\.requested_by IS DISTINCT FROM v_actor/);
  });

  it("pays from released funds, only once the car is cleared", () => {
    expect(migration).toMatch(/v_request\.status NOT IN \('released', 'received', 'paid'\)/);
    expect(migration).toMatch(/cleared_for_payment_at IS NOT NULL/);
  });

  it("keeps the function locked to signed-in users", () => {
    expect(migration).toMatch(/SECURITY DEFINER/);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.complete_purchase_disbursement\(UUID, TEXT\) FROM PUBLIC, anon/,
    );
  });

  it("sends a car with an issue to reconditioning and a clean car to posting (Phase 10)", () => {
    expect(migration).toMatch(/inspection_outcome = 'issue_found'/);
    expect(migration).toMatch(/inspection_issue_reports WHERE transaction_id = v_tx\.id/);
    expect(migration).toMatch(/INSERT INTO public\.reconditioning_jobs \(vehicle_id, transaction_id, mechanic_id\)/);
    expect(migration).toMatch(/SET listing_state = 'awaiting_price_approval'/);
  });

  it("adds a photo to each reconditioning part", () => {
    expect(migration).toMatch(/ALTER TABLE public\.reconditioning_parts ADD COLUMN IF NOT EXISTS photo_path TEXT/);
  });
});
