import { describe, expect, it } from "vitest";

import { splitFieldCaseWorkers } from "./page";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("field case worker directory", () => {
  it("splits the worker directory by role", () => {
    const { informants, mechanics } = splitFieldCaseWorkers([
      { account_id: "i-1", role: "confidential_informant", full_name: "Informant One" },
      { account_id: "m-1", role: "mechanic", full_name: "Mechanic One" },
      { account_id: "i-2", role: "confidential_informant", full_name: null },
    ]);

    expect(informants).toEqual([
      { id: "i-1", full_name: "Informant One" },
      { id: "i-2", full_name: null },
    ]);
    expect(mechanics).toEqual([{ id: "m-1", full_name: "Mechanic One" }]);
  });

  it("survives a missing directory instead of throwing", () => {
    expect(splitFieldCaseWorkers(null)).toEqual({ informants: [], mechanics: [] });
  });

  it("field cases page reads the guarded worker directory, not the CEO-only role list", () => {
    const page = read("src/app/(staff)/field-cases/page.tsx");

    expect(page).toContain('supabase.rpc("list_field_case_workers")');
    expect(page).not.toContain('rpc("get_all_user_roles")');
  });

  it("transaction page reads the guarded worker directory instead of a missing embed", () => {
    const page = read("src/app/(staff)/transactions/[id]/page.tsx");

    expect(page).toContain('supabase.rpc("list_field_case_workers")');
    expect(page).not.toContain("private_user_roles!inner");
  });
});

describe("00046 field case worker directory migration", () => {
  const migration = read("supabase/migrations/00046_task33_field_case_worker_directory.sql");

  it("exposes only informants and mechanics through a guarded SECURITY DEFINER function", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.list_field_case_workers\(\)/i);
    expect(migration).toMatch(/SECURITY DEFINER/i);
    expect(migration).toMatch(/SET search_path = ''/i);
    expect(migration).toMatch(/role IN \('confidential_informant', 'mechanic'\)/i);
    expect(migration).toContain("private.user_roles");
  });

  it("requires an authorized active caller and grants only authenticated execute", () => {
    expect(migration).toMatch(/actor\.account_id = auth\.uid\(\)/i);
    expect(migration).toMatch(/actor\.active = true/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.list_field_case_workers\(\) FROM PUBLIC/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.list_field_case_workers\(\) TO authenticated/i);
    // No blanket exposure of the role table.
    expect(migration).not.toMatch(/GRANT\s+SELECT[^;]*ON\s+private\.user_roles/i);
    expect(migration).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });
});
