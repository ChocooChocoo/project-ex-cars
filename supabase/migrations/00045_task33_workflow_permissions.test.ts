import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(process.cwd(), "supabase/migrations/00045_task33_workflow_permissions.sql");

describe("Task 33 workflow permission migration", () => {
  it("defines nullable transaction-linked customer arrangement policies without broad access", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toMatch(/ALTER TABLE public\.viewing_arrangements\s+ALTER COLUMN inquiry_id\s+DROP NOT NULL/i);
    expect(migration).toMatch(
      /viewing_arrangements[\s\S]*FOR INSERT[\s\S]*TO authenticated[\s\S]*inquiry_id\s+IS\s+NULL[\s\S]*purchase_transaction_id[\s\S]*transactions\.customer_id\s*=\s*auth\.uid\(\)/i,
    );
    expect(migration).toMatch(
      /viewing_arrangements[\s\S]*FOR SELECT[\s\S]*TO authenticated[\s\S]*purchase_transaction_id[\s\S]*transactions\.customer_id\s*=\s*auth\.uid\(\)/i,
    );
    expect(migration).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it("keeps Head Accountant uploads scoped to the transaction folder and INSERT only", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toMatch(
      /storage\.objects[\s\S]*FOR INSERT[\s\S]*bucket_id\s*=\s*'transaction-documents'[\s\S]*storage\.foldername\(name\)/i,
    );
    expect(migration).toMatch(/storage\.objects[\s\S]*role\s*=\s*'head_accountant'/i);
    expect(migration).toMatch(/transaction_documents[\s\S]*FOR INSERT[\s\S]*role\s*=\s*'head_accountant'/i);
    expect(migration).not.toMatch(/Head Accountant[\s\S]*FOR (?:UPDATE|DELETE)/i);
  });

  it("replaces the broad customer document INSERT with a pending buy-document guard", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toMatch(
      /DROP POLICY IF EXISTS "Customers can upload documents" ON public\.transaction_documents;/i,
    );
    expect(migration).not.toMatch(/CREATE POLICY "Customers can upload documents"/i);
    expect(migration).toMatch(
      /CREATE POLICY "Customers can upload own purchase documents"[\s\S]*?ON public\.transaction_documents[\s\S]*?FOR INSERT[\s\S]*?TO authenticated[\s\S]*?WITH CHECK \([\s\S]*?uploader_id\s*=\s*auth\.uid\(\)[\s\S]*?document_kind\s+IN\s*\(\s*'valid_id'\s*,\s*'proof_of_billing'\s*\)[\s\S]*?verification_state\s*=\s*'pending'[\s\S]*?transactions\.customer_id\s*=\s*auth\.uid\(\)[\s\S]*?transactions\.transaction_kind\s*=\s*'buy'/i,
    );
    expect(migration).toMatch(/storage_path\s+IS NULL[\s\S]*transaction_documents\.transaction_id::text/i);
  });
});
