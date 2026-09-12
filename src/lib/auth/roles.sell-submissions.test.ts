import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ROLE_NAV_ACCESS, SELL_SUBMISSION_VIEWER_ROLES } from "./roles";

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("SELL_SUBMISSION_VIEWER_ROLES", () => {
  it("is exactly the two documented field roles", () => {
    expect(SELL_SUBMISSION_VIEWER_ROLES).toEqual(["mechanic", "confidential_informant"]);
  });

  it("excludes every role that already has the transaction list or no field duty", () => {
    for (const role of ["ceo", "account_manager", "head_accountant", "sales_manager", "marketing_specialist", "head_security", "customer", "supplier"]) {
      expect(SELL_SUBMISSION_VIEWER_ROLES).not.toContain(role);
    }
  });
});

describe("sell-submission navigation", () => {
  it("offers the surface to both field roles and nobody else", () => {
    const withAccess = Object.entries(ROLE_NAV_ACCESS)
      .filter(([, access]) => access !== "all" && access.has("sell-submissions"))
      .map(([role]) => role)
      .sort();

    expect(withAccess).toEqual(["confidential_informant", "mechanic"]);
  });

  it("links the sidebar item at the route the page lives on", () => {
    const items = read("src/navigation/sidebar/sidebar-items.ts");

    expect(items).toContain('id: "sell-submissions"');
    expect(items).toContain('url: "/sell-submissions"');
  });

  it("guards the route with the shared viewer list", () => {
    const page = read("src/app/(staff)/sell-submissions/page.tsx");

    expect(page).toContain("SELL_SUBMISSION_VIEWER_ROLES");
    expect(page).toMatch(/await requireRole\(SELL_SUBMISSION_VIEWER_ROLES\)/);
  });

  it("reads submissions only through the scoped list RPC", () => {
    const page = read("src/app/(staff)/sell-submissions/page.tsx");

    // The RPC is the only way a field role can see the car: `transactions` has no policy for it.
    expect(page).toMatch(/rpc\("list_field_sell_submissions"\)/);
    expect(page).toMatch(/\.eq\("document_kind", "sell_photo"\)/);
    // Signing stays server-side.
    expect(page).toContain("withSignedTransactionDocumentUrls");
  });
});
