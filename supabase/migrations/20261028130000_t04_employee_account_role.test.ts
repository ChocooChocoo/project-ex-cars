import { describe, expect, it } from "vitest";

import { STAFF_ROLES } from "@/lib/auth/roles";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261028130000_t04_employee_account_role.sql"),
  "utf8",
);

describe("T04 E6 employee account role migration", () => {
  it("creates a security definer function with a fixed search path", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.set_new_employee_role\(/);
    expect(migration).toMatch(/SECURITY DEFINER/);
    expect(migration).toMatch(/SET search_path = ''/);
  });

  it("is callable by the server only (service_role), never by browsers", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.set_new_employee_role\(UUID, TEXT, UUID\) FROM PUBLIC/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.set_new_employee_role\(UUID, TEXT, UUID\) FROM anon/);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.set_new_employee_role\(UUID, TEXT, UUID\) FROM authenticated/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.set_new_employee_role\(UUID, TEXT, UUID\) TO service_role/,
    );
  });

  it("allows every staff role except ceo", () => {
    const list = migration.match(/v_allowed_roles TEXT\[\] := ARRAY\[([\s\S]*?)\]/)?.[1] ?? "";
    const roles = [...list.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    expect(roles).toEqual(STAFF_ROLES.filter((r) => r !== "ceo").sort());
  });

  it("checks the actor is the CEO or the Account Manager", () => {
    expect(migration).toMatch(/account_id = p_assigned_by[\s\S]*role IN \('ceo', 'account_manager'\)/);
  });

  it("only promotes a fresh customer row, never an existing staff role", () => {
    expect(migration).toMatch(/WHERE account_id = p_account_id AND active = true AND role = 'customer'/);
  });
});
