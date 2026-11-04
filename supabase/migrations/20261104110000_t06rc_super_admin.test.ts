import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261104110000_t06rc_super_admin.sql"),
  "utf8",
);

describe("T06 Super Admin migration", () => {
  it("allows the super_admin role on accounts", () => {
    expect(migration).toMatch(/ADD CONSTRAINT user_roles_role_check CHECK[\s\S]*'super_admin'/);
  });

  it("admits the Super Admin to account, role and RBAC management only", () => {
    const tables = new Set([...migration.matchAll(/ON public\.(\w+) FOR/g)].map((m) => m[1]));
    expect(tables).toEqual(
      new Set([
        "profiles",
        "rbac_access_areas",
        "rbac_actions",
        "rbac_roles",
        "rbac_permissions",
        "rbac_role_permissions",
      ]),
    );
    const functions = [...migration.matchAll(/FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
    expect(functions).toEqual(["update_rbac_role", "assign_user_role", "get_all_user_roles"]);
  });

  it("keeps every guard it rewrites", () => {
    expect(migration.match(/RAISE EXCEPTION 'Permission denied/g)).toHaveLength(3);
    expect(migration).toMatch(/assigned_by must match the authenticated user/);
  });
});
