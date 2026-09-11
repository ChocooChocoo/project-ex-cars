import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { TRANSACTION_VIEWER_ROLES } from "./roles";

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("TRANSACTION_VIEWER_ROLES", () => {
  it("lists exactly the five documented transaction viewers, in order", () => {
    expect(TRANSACTION_VIEWER_ROLES).toEqual([
      "ceo",
      "account_manager",
      "head_accountant",
      "confidential_informant",
      "sales_manager",
    ]);
  });

  it("excludes the mechanic, who sees sell evidence through the inspection detail instead", () => {
    expect(TRANSACTION_VIEWER_ROLES).not.toContain("mechanic");
  });
});

describe("transaction route guards", () => {
  it("guards the list route with the shared viewer list", () => {
    const page = read("src/app/(staff)/transactions/page.tsx");

    expect(page).toContain("TRANSACTION_VIEWER_ROLES");
    expect(page).toMatch(/await requireRole\(TRANSACTION_VIEWER_ROLES\)/);
  });

  it("guards the detail route identically, so a denial redirects instead of 404ing", () => {
    const page = read("src/app/(staff)/transactions/[id]/page.tsx");

    expect(page).toContain("TRANSACTION_VIEWER_ROLES");
    expect(page).toMatch(/await requireRole\(TRANSACTION_VIEWER_ROLES\)/);
    // The guard must run before the row fetch, otherwise RLS filters the row and
    // notFound() answers with a misleading 404.
    expect(page.indexOf("requireRole(TRANSACTION_VIEWER_ROLES)")).toBeLessThan(page.indexOf('.from("transactions")'));
  });
});
