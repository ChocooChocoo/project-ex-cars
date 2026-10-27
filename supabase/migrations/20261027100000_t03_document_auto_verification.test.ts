import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261027100000_t03_document_auto_verification.sql"),
  "utf8",
);

describe("T03 document auto-verification migration", () => {
  it("adds the auto-check columns with a fixed status list", () => {
    expect(migration).toMatch(
      /auto_check_status TEXT\s+CHECK \(auto_check_status IN \('verified', 'failed', 'manual_review'\)\)/,
    );
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS auto_check_provider TEXT");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS auto_check_detail TEXT");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS auto_checked_at TIMESTAMPTZ");
  });

  it("stops browser sessions from writing the auto-check result", () => {
    expect(migration).toMatch(/IF current_user IN \('anon', 'authenticated'\)/);
    expect(migration).toMatch(/NEW\.auto_check_status := NULL/);
    expect(migration).toMatch(/NEW\.auto_check_status := OLD\.auto_check_status/);
    expect(migration).toMatch(
      /CREATE TRIGGER guard_document_auto_check\s+BEFORE INSERT OR UPDATE ON public\.transaction_documents/,
    );
  });
});
