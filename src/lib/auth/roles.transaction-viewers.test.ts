import { describe, expect, it } from "vitest";

import { TRANSACTION_VIEWER_ROLES } from "./roles";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("TRANSACTION_VIEWER_ROLES", () => {
  it("lists exactly the documented transaction viewers, in order", () => {
    expect(TRANSACTION_VIEWER_ROLES).toEqual([
      "ceo",
      "account_manager",
      "head_accountant",
      "confidential_informant",
      "sales_manager",
      "marketing_specialist",
    ]);
  });

  it("excludes the mechanic, who sees sell evidence through the inspection detail instead", () => {
    expect(TRANSACTION_VIEWER_ROLES).not.toContain("mechanic");
  });
});

describe("transaction route guards", () => {
  it("guards the list route with the shared viewer list", () => {
    const page = read("src/app/(staff)/transactions/page.tsx");

    expect(page).toContain("useRequireRole(TRANSACTION_VIEWER_ROLES)");
  });

  it("guards the detail route identically, and Laravel guards both reads", () => {
    const loader = read("src/app/(staff)/transactions/[id]/_components/staff-transaction-detail-page.tsx");
    const routes = read("backend/routes/api.php");

    expect(loader).toContain("useRequireRole(TRANSACTION_VIEWER_ROLES)");
    // The role check runs before the request, so a denial redirects instead of answering 404.
    expect(loader.indexOf("useRequireRole(TRANSACTION_VIEWER_ROLES)")).toBeLessThan(loader.indexOf("usePageData("));
    expect(routes).toContain(
      "Route::get('transactions/{id}', [StaffTradingReadController::class, 'show'])->middleware('role:'.implode(',', Role::TRANSACTION_VIEWERS))",
    );
  });
});
