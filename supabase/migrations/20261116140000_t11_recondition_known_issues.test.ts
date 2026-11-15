import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261116140000_t11_recondition_known_issues.sql"),
  "utf8",
);

const routing = migration.slice(
  migration.indexOf("SELECT mechanic_id, inspection_outcome = 'issue_found'"),
  migration.indexOf("IF v_has_issue THEN"),
);

describe("T11 reconditioning covers declared issues", () => {
  it("redefines the seller-paid function it patches", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.complete_purchase_disbursement\(/);
    expect(migration).toMatch(/p_disbursement_id UUID,\s+p_notes TEXT DEFAULT NULL/);
    expect(migration).toMatch(/RETURNS VOID\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = ''/);
  });

  it("treats a declared known issue as an issue", () => {
    expect(migration).toMatch(/has_known_issues/);
    expect(migration).toMatch(
      /COALESCE\(\(SELECT has_known_issues FROM public\.sell_details WHERE transaction_id = v_tx\.id\), false\)/,
    );
  });

  it("still routes a hidden or inspected issue to reconditioning", () => {
    expect(routing).toMatch(/inspection_outcome = 'issue_found'/);
    expect(routing).toMatch(
      /EXISTS \(SELECT 1 FROM public\.inspection_issue_reports WHERE transaction_id = v_tx\.id\)/,
    );
    expect(migration).toMatch(/SET listing_state = 'repairing'/);
  });

  it("sends a car with no issue at all to price approval", () => {
    expect(migration).toMatch(/SET listing_state = 'awaiting_price_approval'/);
    expect(migration).toMatch(/IF v_has_issue THEN/);
  });

  it("keeps the payment guards and the requester-only rule unchanged", () => {
    expect(migration).toMatch(/NOT v_head_accountant AND v_request\.requested_by IS DISTINCT FROM v_actor/);
    expect(migration).toMatch(/cleared_for_payment_at IS NOT NULL/);
  });

  it("keeps the function locked to signed-in users", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.complete_purchase_disbursement\(UUID, TEXT\) FROM PUBLIC, anon;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.complete_purchase_disbursement\(UUID, TEXT\) TO authenticated;/,
    );
  });
});
