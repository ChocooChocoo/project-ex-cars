import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(process.cwd(), "supabase/migrations/00047_task32_inspection_sell_submission.sql");
const migration = (() => {
  try {
    return readFileSync(migrationPath, "utf8");
  } catch {
    return "";
  }
})();

function functionBody() {
  const match = migration.match(
    /CREATE OR REPLACE FUNCTION public\.get_inspection_sell_submission\([\s\S]*?\$\$([\s\S]*?)\$\$;/i,
  );
  return match?.[1] ?? "";
}

describe("inspection sell submission RPC migration", () => {
  it("defines a stable security-definer function with a fixed search path", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_inspection_sell_submission\(inspection_id UUID\)[\s\S]*RETURNS TABLE \(transaction_id UUID, condition_items JSONB\)[\s\S]*LANGUAGE sql[\s\S]*SECURITY DEFINER[\s\S]*STABLE[\s\S]*SET search_path = ''/i,
    );
  });

  it("allows only the assigned active mechanic or an active confidential informant", () => {
    const body = functionBody();

    expect(body).toMatch(/inspection\.id\s*=\s*inspection_id/i);
    expect(body).toMatch(
      /actor\.account_id\s*=\s*auth\.uid\(\)[\s\S]*actor\.active\s*=\s*true[\s\S]*actor\.role\s*=\s*'mechanic'[\s\S]*inspection\.mechanic_id\s*=\s*auth\.uid\(\)/i,
    );
    expect(body).toMatch(/actor\.role\s*=\s*'confidential_informant'/i);
    expect(body).not.toMatch(/'ceo'|'account_manager'|'sales_manager'|'head_accountant'/i);
  });

  it("returns only sell checklist linkage for the inspected vehicle and at most one deterministic row", () => {
    const body = functionBody();

    expect(body).toMatch(/SELECT transaction\.id, sell\.condition_items/i);
    expect(body).toMatch(/public\.vehicle_inspections AS inspection/i);
    expect(body).toMatch(
      /public\.transactions AS transaction\s+ON transaction\.vehicle_id\s*=\s*inspection\.vehicle_id/i,
    );
    expect(body).toMatch(/public\.sell_details AS sell\s+ON sell\.transaction_id\s*=\s*transaction\.id/i);
    expect(body).toMatch(/transaction\.transaction_kind\s*=\s*'sell'/i);
    expect(body).toMatch(/ORDER BY transaction\.opened_at DESC, transaction\.created_at DESC, transaction\.id DESC/i);
    expect(body).toMatch(/LIMIT 1/i);
    expect(body).not.toMatch(
      /offered_amount|valuation_amount|review_notes|decision(?:_maker|_date)?|current_state|customer_id/i,
    );
  });

  it("revokes public execution and grants authenticated execution only", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.get_inspection_sell_submission\(UUID\) FROM PUBLIC;/i);
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_inspection_sell_submission\(UUID\) TO authenticated;/i,
    );
  });
});
