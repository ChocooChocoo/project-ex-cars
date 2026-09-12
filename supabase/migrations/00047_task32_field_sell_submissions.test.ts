import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(process.cwd(), "supabase/migrations/00047_task32_field_sell_submissions.sql");
const migration = (() => {
  try {
    return readFileSync(migrationPath, "utf8");
  } catch {
    return "";
  }
})();

function functionBody() {
  const match = migration.match(/CREATE OR REPLACE FUNCTION public\.list_field_sell_submissions\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/i);
  return match?.[1] ?? "";
}

describe("field sell-submission list RPC migration", () => {
  it("defines a stable security-definer function with a fixed search path", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.list_field_sell_submissions\(\)/i);
    expect(migration).toMatch(/LANGUAGE sql[\s\S]*SECURITY DEFINER[\s\S]*STABLE[\s\S]*SET search_path = ''/i);
  });

  it("returns only the car and checklist the field roles need", () => {
    const returns = migration.match(/RETURNS TABLE \(([\s\S]*?)\)\s*LANGUAGE/i)?.[1] ?? "";

    for (const required of [
      "transaction_id UUID",
      "current_state TEXT",
      "opened_at TIMESTAMPTZ",
      "vehicle_make TEXT",
      "vehicle_model TEXT",
      "vehicle_year INTEGER",
      "vehicle_stock_code TEXT",
      "condition_items JSONB",
    ]) {
      expect(returns).toContain(required);
    }

    // The negotiation stays out: seeing the photos must not mean seeing the commercial side.
    expect(returns).not.toMatch(/offered_amount|valuation_amount|review_notes|decision/i);
    expect(returns).not.toMatch(/customer_id|payment|amount/i);
  });

  it("exposes only sell submissions, joined to the car through the blocked table", () => {
    const body = functionBody();

    expect(body).toMatch(/FROM public\.transactions AS transaction/i);
    expect(body).toMatch(/JOIN public\.sell_details AS sell ON sell\.transaction_id = transaction\.id/i);
    expect(body).toMatch(/LEFT JOIN public\.vehicles AS vehicle ON vehicle\.id = transaction\.vehicle_id/i);
    expect(body).toMatch(/transaction\.transaction_kind = 'sell'/i);
    // A sell_details row is what makes something a submission.
    expect(body).toMatch(/COALESCE\(sell\.condition_items/i);
  });

  it("allows the two documented field roles and nobody else", () => {
    const body = functionBody();

    expect(body).toMatch(/actor\.account_id = auth\.uid\(\)/i);
    expect(body).toMatch(/actor\.active = true/i);
    expect(body).toMatch(/actor\.role IN \('mechanic', 'confidential_informant'\)/i);
    expect(body).not.toMatch(/'ceo'|'account_manager'|'sales_manager'|'head_accountant'|'customer'/i);
  });

  it("is ordered deterministically and revokes public and anonymous execution", () => {
    expect(functionBody()).toMatch(/ORDER BY transaction\.opened_at DESC/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.list_field_sell_submissions\(\) FROM PUBLIC;/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.list_field_sell_submissions\(\) FROM anon;/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.list_field_sell_submissions\(\) TO authenticated;/i);
  });

  it("does not widen any table policy", () => {
    expect(migration).not.toMatch(/CREATE POLICY|ALTER POLICY|DISABLE ROW LEVEL SECURITY/i);
  });
});
