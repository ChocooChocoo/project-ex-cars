import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00059_t01_scenario_flow_fields.sql"),
  "utf8",
);

describe("T01 scenario flow fields migration", () => {
  it("adds the monthly payment, the missed payment policy and the delivery fee to the financing terms", () => {
    expect(migration).toMatch(/ALTER TABLE public\.payment_terms/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS monthly_payment NUMERIC\(12,2\)/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS missed_payment_policy TEXT/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC\(12,2\)/);
  });

  it("records the buyer's requested term (1, 2, 3 or 5 years) and the delivery terms agreement", () => {
    expect(migration).toMatch(/requested_term_months INTEGER CHECK \(requested_term_months IN \(12, 24, 36, 60\)\)/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS delivery_terms_agreed_at TIMESTAMPTZ/);
  });

  it("allows a chat thread tied to a financing request", () => {
    expect(migration).toMatch(/intention_kind IN \('inquiry', 'buy_now', 'sell_negotiation', 'buy_financing'\)/);
    expect(migration).toMatch(
      /\(intention_kind IN \('sell_negotiation', 'buy_financing'\)\) = \(transaction_id IS NOT NULL\)/,
    );
  });

  it("only adds: no column, table or policy is dropped", () => {
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN|POLICY)|DISABLE ROW LEVEL SECURITY/i);
  });
});
