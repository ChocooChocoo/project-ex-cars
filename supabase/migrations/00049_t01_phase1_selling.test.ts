import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/00049_t01_phase1_selling.sql"), "utf8");

function policyBlock(name: string) {
  return migration.match(new RegExp(`CREATE POLICY "${name}"([\\s\\S]*?);\\n`, "i"))?.[1] ?? "";
}

describe("T01 Phase 1 selling migration", () => {
  it("keeps ceilings tied to a sell transaction and one pending proposal per kind", () => {
    expect(migration).toMatch(/proposal_kind IN \('purchase_ceiling', 'revised_ceiling', 'selling_price', 'reprice'\)/);
    expect(migration).toMatch(
      /CHECK \(\(proposal_kind IN \('purchase_ceiling', 'revised_ceiling'\)\) = \(transaction_id IS NOT NULL\)\)/,
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_price_proposals_one_pending_per_kind[\s\S]*\(vehicle_id, proposal_kind\)[\s\S]*WHERE decision = 'pending'/,
    );
  });

  it("links a negotiation thread only to the customer's own sell transaction", () => {
    expect(migration).toMatch(/CHECK \(\(intention_kind = 'sell_negotiation'\) = \(transaction_id IS NOT NULL\)\)/);
    const insert = policyBlock("Customers can create inquiries");
    expect(insert).toMatch(/customer_id = auth\.uid\(\)/);
    expect(insert).toMatch(/transactions\.customer_id = auth\.uid\(\)[\s\S]*transaction_kind = 'sell'/);
  });

  it("scopes every Marketing Specialist read to sell offers", () => {
    expect(policyBlock("Marketing Specialist can read sell transactions")).toMatch(
      /transaction_kind = 'sell'[\s\S]*role = 'marketing_specialist'/,
    );
    for (const name of [
      "Marketing Specialist can read sell status history",
      "Marketing Specialist can read sell documents",
      "Marketing Specialist can read sell document files",
    ]) {
      expect(policyBlock(name)).toMatch(/transactions\.transaction_kind = 'sell'/);
    }
    expect(policyBlock("Marketing Specialist can read sell negotiations")).toMatch(
      /intention_kind = 'sell_negotiation'/,
    );
    expect(policyBlock("Marketing Specialist can send sell negotiation messages")).toMatch(
      /sender_id = auth\.uid\(\)[\s\S]*intention_kind = 'sell_negotiation'/,
    );
  });

  it("accepts a customer's sell papers only as pending documents on their own sell offer", () => {
    const policy = policyBlock("Customers can upload own sell papers");
    expect(policy).toMatch(/document_kind IN \('valid_id', 'orcr', 'deed_of_sale'\)/);
    expect(policy).toMatch(/verification_state = 'pending'/);
    expect(policy).toMatch(/transactions\.customer_id = auth\.uid\(\)[\s\S]*transaction_kind = 'sell'/);
  });

  it("adds no write policies for the new tables and never broadens access", () => {
    for (const table of ["inspection_issue_reports", "field_case_expenses"]) {
      expect(migration).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
      expect(migration).not.toMatch(new RegExp(`ON public\\.${table} FOR (INSERT|UPDATE|DELETE)`));
    }
    expect(migration).toMatch(
      /CHECK \(NOT is_profitable OR \(recalculated_price IS NOT NULL AND new_ceiling IS NOT NULL\)\)/,
    );
    expect(migration).toMatch(/proof_document_id UUID NOT NULL REFERENCES public\.transaction_documents\(id\)/);
    expect(migration).not.toMatch(/FOR ALL|DISABLE ROW LEVEL SECURITY|USING\s*\(\s*true\s*\)/i);
  });

  it("lets the Marketing Specialist read the worker directory without widening who is listed", () => {
    expect(migration).toMatch(/worker\.role IN \('confidential_informant', 'mechanic'\)/);
    expect(migration).toMatch(/'marketing_specialist'\s*\)\s*\)\s*ORDER BY profile\.full_name/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.list_field_case_workers\(\) FROM PUBLIC;/);
  });
});
