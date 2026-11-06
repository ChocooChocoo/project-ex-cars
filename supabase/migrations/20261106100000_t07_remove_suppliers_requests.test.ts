import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261106100000_t07_remove_suppliers_requests.sql"),
  "utf8",
);

describe("T07 retired surfaces migration", () => {
  it("deletes dependent payments before request transactions and drops retired tables", () => {
    expect(migration).toMatch(/DELETE FROM public\.payment_records[\s\S]*DELETE FROM public\.transactions/);
    for (const table of ["supplier_messages", "supplier_documents", "suppliers", "vehicle_requests"]) {
      expect(migration).toContain(`DROP TABLE IF EXISTS public.${table};`);
    }
    expect(migration).toMatch(/ALTER PUBLICATION supabase_realtime DROP TABLE public\.supplier_messages/);
  });

  it("removes storage metadata and bucket-specific policies", () => {
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Approved suppliers can read own documents" ON storage\.objects/);
    expect(migration).toMatch(/DELETE FROM storage\.objects WHERE bucket_id = 'supplier-documents'/);
    expect(migration).toMatch(/DELETE FROM storage\.buckets WHERE id = 'supplier-documents'/);
  });

  it("removes both supplier roles and restricts transactions to buy and sell", () => {
    expect(migration).toContain("DELETE FROM private.user_roles WHERE role = 'supplier'");
    expect(migration).toContain("DELETE FROM public.rbac_roles WHERE role_key = 'supplier'");
    for (const constraint of ["user_roles_role_check", "rbac_roles_role_key_check"]) {
      const definition = migration.match(new RegExp(`ADD CONSTRAINT ${constraint} CHECK \\([\\s\\S]*?\\);`))?.[0];
      expect(definition).toBeDefined();
      expect(definition).not.toContain("'supplier'");
    }
    expect(migration).toMatch(
      /ADD CONSTRAINT transactions_transaction_kind_check\s+CHECK \(transaction_kind IN \('buy', 'sell'\)\)/,
    );
  });

  it("keeps existing sourcing history instead of deleting it", () => {
    expect(migration).toMatch(/IF NOT EXISTS \(SELECT 1 FROM public\.field_cases WHERE case_kind = 'sourcing'\)/);
    expect(migration).not.toMatch(/DELETE FROM public\.field_cases/);
  });
});
