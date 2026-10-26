import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261026090000_t03_rbac_ceo_only.sql"),
  "utf8",
);

const policyBody = (name: string) => {
  const start = migration.indexOf(`CREATE POLICY "${name}"`);
  expect(start, `policy ${name} is recreated`).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf(";", start));
};

describe("T03 RBAC: CEO-only migration", () => {
  it("limits every RBAC write policy to the CEO", () => {
    for (const name of [
      "RBAC managers can create role definitions",
      "RBAC managers can update role definitions",
      "RBAC managers can create permissions",
      "RBAC managers can assign permissions",
      "RBAC managers can remove permissions",
    ]) {
      const body = policyBody(name);
      expect(body).toMatch(/ur\.role = 'ceo'/);
      expect(body).not.toMatch(/account_manager/);
    }
  });

  it("limits update_rbac_role and assign_user_role to the CEO", () => {
    const rbac = migration.slice(migration.indexOf("FUNCTION public.update_rbac_role"));
    const assign = migration.slice(migration.indexOf("FUNCTION public.assign_user_role"));

    expect(rbac.slice(0, rbac.indexOf("$$;"))).toMatch(/ur\.role = 'ceo'/);
    expect(assign.slice(0, assign.indexOf("$$;"))).toMatch(/role = 'ceo'/);
    expect(rbac.slice(0, rbac.indexOf("$$;"))).not.toMatch(/account_manager/);
    expect(assign.slice(0, assign.indexOf("$$;"))).not.toMatch(/'account_manager'\)/);
  });

  it("takes the Account Manager's role-granting and field case permissions away", () => {
    expect(migration).toMatch(/DELETE FROM public\.rbac_role_permissions/);
    for (const key of ["roles.create", "roles.update", "roles.assign", "field_cases.read"]) {
      expect(migration).toContain(`'${key}'`);
    }
  });

  it("drops the Account Manager from reading field cases", () => {
    const body = policyBody("Staff can read field cases");
    expect(body).not.toMatch(/account_manager/);
    expect(body).toMatch(/'ceo'/);
  });
});
