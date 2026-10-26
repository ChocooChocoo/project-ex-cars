import { describe, expect, it } from "vitest";

import { brandFor } from "./sidebar-brand";

describe("sidebar brand", () => {
  it("reads GCE Admin and opens the dashboard for staff, even roles that land elsewhere", () => {
    expect(brandFor("account_manager")).toEqual({ label: "GCE Admin", href: "/account_manager/dashboard" });
    expect(brandFor("sales_manager")).toEqual({ label: "GCE Admin", href: "/sales_manager/dashboard" });
  });

  it("reads Global Car Exchange and opens the Showroom for the customer", () => {
    expect(brandFor("customer")).toEqual({ label: "Global Car Exchange", href: "/customer/showroom" });
  });

  it("sends a supplier to its own overview", () => {
    expect(brandFor("supplier")).toEqual({ label: "Global Car Exchange", href: "/supplier/overview" });
  });

  it("falls back to the dashboard when the role is unknown", () => {
    expect(brandFor(null)).toEqual({ label: "Global Car Exchange", href: "/dashboard/default" });
  });
});
