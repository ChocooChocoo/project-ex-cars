import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vehicles RLS head_accountant proposals read", () => {
  it("migration 00039 exists with scoped EXISTS and no USING(true) or service_role", () => {
    const migrationPath = resolve(process.cwd(), "supabase/migrations/00039_head_accountant_proposals_read.sql");
    const content = readFileSync(migrationPath, "utf8");

    expect(content).toContain("Head Accountant can read proposals");
    expect(content).toContain("vehicle_price_proposals");
    expect(content).toContain("FOR SELECT");
    expect(content).toContain("TO authenticated");
    expect(content).toContain("EXISTS");
    expect(content).toContain("private.user_roles");
    expect(content).toContain("head_accountant");
    // Must be scoped, not permissive
    expect(content).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(content).not.toContain("DISABLE RLS");
    expect(content).not.toContain("service_role");
    // Must use correct columns account_id and active, with (select auth.uid())
    expect(content).toMatch(/account_id\s*=\s*\(select auth\.uid\(\)\)/);
    expect(content).toContain("active = true");
  });

  it("vehicles page uses normal client for head_accountant, not admin", () => {
    const pagePath = resolve(process.cwd(), "src/app/(staff)/vehicles/page.tsx");
    const content = readFileSync(pagePath, "utf8");
    expect(content).toContain("isHeadAccountant");
    expect(content).toContain("vehicle_price_proposals");
    expect(content).toContain('eq("decision", "pending")');
    expect(content).not.toContain("createAdminClient");
    expect(content).not.toContain("service_role");
  });
});
