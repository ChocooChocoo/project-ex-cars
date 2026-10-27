import { describe, expect, it } from "vitest";

import { ROLE_NAV_ACCESS, STAFF_ROLES } from "./roles";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

const navFor = (role: (typeof STAFF_ROLES)[number]) => {
  const access = ROLE_NAV_ACCESS[role];
  if (access === "all") throw new Error(`${role} uses "all"; list its items instead`);
  return access;
};

// T03 R1: the CEO holds full access. Sell submissions is the one exception: it is the mechanic's and the
// Confidential Informant's narrow view of cars the CEO already sees in Transactions.
const CEO_EXCEPTIONS = new Set(["sell-submissions"]);

describe("CEO navigation (T03 R1)", () => {
  it("includes every staff nav item any other staff role can see", () => {
    const ceo = navFor("ceo");
    const missing = new Set<string>();
    for (const role of STAFF_ROLES) {
      for (const id of navFor(role)) {
        if (!ceo.has(id) && !CEO_EXCEPTIONS.has(id)) missing.add(id);
      }
    }

    expect([...missing]).toEqual([]);
  });

  it("lets the CEO create walk-in accounts too", () => {
    const actions = read("src/app/auth/actions.ts");
    const page = read("src/app/(staff)/staff-records/page.tsx");

    expect(actions).toMatch(/authorizeAction\(\["account_manager", "ceo"\]\)/);
    expect(page).toMatch(/role === "account_manager" \|\| role === "ceo"/);
  });
});

describe("Account Manager navigation (T03 R2, AM6)", () => {
  it("has no Roles and no Field Cases", () => {
    const am = navFor("account_manager");

    expect(am.has("roles")).toBe(false);
    expect(am.has("field-cases")).toBe(false);
  });

  it("still manages employees", () => {
    const am = navFor("account_manager");

    for (const id of ["users", "staff-records", "create-walk-in", "attendance", "payroll"]) {
      expect(am.has(id)).toBe(true);
    }
  });

  it("is kept out of the Roles and Field Cases pages", () => {
    expect(read("src/app/(staff)/roles/page.tsx")).toMatch(/requireRole\(\["ceo"\]\)/);
    expect(read("src/app/(staff)/field-cases/page.tsx")).not.toMatch(/"account_manager"/);
  });

  it("cannot assign roles through assignRole", () => {
    const actions = read("src/app/auth/actions.ts");
    const assignRole = actions.slice(actions.indexOf("export async function assignRole"));

    expect(assignRole.slice(0, 600)).not.toMatch(/account_manager/);
  });
});
