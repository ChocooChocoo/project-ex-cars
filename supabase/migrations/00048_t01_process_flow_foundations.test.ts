import { describe, expect, it } from "vitest";

import { FLOW_STATUSES, PAYMENT_METHODS, TRANSACTION_FLAGS } from "@/lib/transactions/state-machine";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(process.cwd(), "supabase/migrations/00048_t01_process_flow_foundations.sql");
const migration = readFileSync(migrationPath, "utf8");

function checkList(column: string) {
  const match = migration.match(new RegExp(`${column} TEXT\\s+CHECK \\(${column} IN \\(([\\s\\S]*?)\\)\\)`, "i"));
  return [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

function policyBlock(name: string) {
  const match = migration.match(new RegExp(`CREATE POLICY "${name}"([\\s\\S]*?);\\n`, "i"));
  return match?.[1] ?? "";
}

describe("T01 Phase 0 foundations migration", () => {
  it("keeps the flow_status and flag checks in sync with the TypeScript model", () => {
    expect(checkList("flow_status")).toEqual([...FLOW_STATUSES]);
    expect(checkList("flag")).toEqual([...TRANSACTION_FLAGS]);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ;/i);
  });

  it("addresses each notification to exactly one role or one user", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES auth\.users\(id\)/i);
    expect(migration).toMatch(/ALTER COLUMN recipient_role DROP NOT NULL/i);
    expect(migration).toMatch(/CHECK \(\(recipient_role IS NULL\) <> \(recipient_id IS NULL\)\)/i);
    expect(policyBlock("Users can read own user notifications")).toMatch(
      /FOR SELECT[\s\S]*USING \(recipient_id = auth\.uid\(\)\)/i,
    );
    expect(policyBlock("Users can mark own user notifications read")).toMatch(
      /FOR UPDATE[\s\S]*WITH CHECK \(recipient_id = auth\.uid\(\) AND is_read = true\)/i,
    );
  });

  it("widens document kinds and payment methods without dropping existing values", () => {
    for (const kind of ["valid_id", "sell_photo", "orcr", "deed_of_sale", "inspection_photo", "expense_proof"]) {
      expect(migration).toContain(`'${kind}'`);
    }
    const methods = migration.match(/CHECK \(payment_method IN \(([^)]*)\)\)/i)?.[1] ?? "";
    expect([...methods.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...PAYMENT_METHODS]);
  });

  it("lets customers only read their own standing and only Sales Manager and CEO write it", () => {
    expect(migration).toMatch(/ALTER TABLE public\.customer_standing ENABLE ROW LEVEL SECURITY/i);
    expect(policyBlock("Customers can read own standing")).toMatch(/FOR SELECT[\s\S]*account_id = auth\.uid\(\)/i);

    for (const name of ["Sales Manager and CEO can create standing", "Sales Manager and CEO can update standing"]) {
      expect(policyBlock(name)).toMatch(/role IN \('sales_manager', 'ceo'\)/i);
    }

    // Every write policy on the table is the role-gated pair above.
    expect(migration.match(/ON public\.customer_standing\s+FOR (?:INSERT|UPDATE)/gi)).toHaveLength(2);
    expect(migration).not.toMatch(/FOR ALL|FOR DELETE|DISABLE ROW LEVEL SECURITY|USING\s*\(\s*true\s*\)/i);
  });
});
