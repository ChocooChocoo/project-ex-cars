import { describe, expect, it } from "vitest";

import { ROLE_LANDING_PAGES, ROLE_NAV_ACCESS } from "./roles";

describe("ROLE_NAV_ACCESS.supplier — WS-A minimal discoverability fix", () => {
  it("contains supplier-messages as discoverable", () => {
    const access = ROLE_NAV_ACCESS.supplier;
    expect(access).not.toBe("all");
    if (access === "all") return;
    expect(access.has("supplier-messages")).toBe(true);
  });

  it("still contains the 7 cust-* customer portal items (reversible, no removal yet)", () => {
    const access = ROLE_NAV_ACCESS.supplier;
    expect(access).not.toBe("all");
    if (access === "all") return;
    const custIds = [
      "cust-showroom",
      "cust-recommendations",
      "cust-inquiries",
      "cust-transactions",
      "cust-request-car",
      "cust-sell-vehicle",
      "cust-favourites",
    ];
    for (const id of custIds) {
      expect(access.has(id)).toBe(true);
    }
    expect(access.has("supplier-messages")).toBe(true);
    expect(access.has("supplier-overview")).toBe(true);
    expect(access.size).toBe(9);
  });

  it("contains supplier-overview as isolated profile", async () => {
    const access = ROLE_NAV_ACCESS.supplier;
    expect(access).not.toBe("all");
    if (access === "all") return;
    expect(access.has("supplier-overview")).toBe(true);
    const { sidebarItems } = await import("@/navigation/sidebar/sidebar-items");
    const allIds = sidebarItems.flatMap((g) => g.items.map((i) => ({ id: i.id, url: "url" in i ? i.url : null })));
    const found = allIds.find((i) => i.id === "supplier-overview");
    expect(found).toBeDefined();
    expect(found?.url).toBe("/overview");
  });

  it("maps supplier-messages to existing sidebar item id and url /supplier-messages", async () => {
    const { sidebarItems } = await import("@/navigation/sidebar/sidebar-items");
    const allIds = sidebarItems.flatMap((g) => g.items.map((i) => ({ id: i.id, url: "url" in i ? i.url : null })));
    const found = allIds.find((i) => i.id === "supplier-messages");
    expect(found).toBeDefined();
    expect(found?.url).toBe("/supplier-messages");
  });

  it("is no longer identical to customer (diverged by supplier-messages and supplier-overview)", () => {
    const supplier = ROLE_NAV_ACCESS.supplier;
    const customer = ROLE_NAV_ACCESS.customer;
    expect(supplier).not.toBe("all");
    expect(customer).not.toBe("all");
    if (supplier === "all" || customer === "all") return;
    expect(supplier.has("supplier-messages")).toBe(true);
    expect(customer.has("supplier-messages")).toBe(false);
    expect(supplier.has("supplier-overview")).toBe(true);
    expect(customer.has("supplier-overview")).toBe(false);
  });

  it("does NOT expose full /suppliers management to supplier", () => {
    const access = ROLE_NAV_ACCESS.supplier;
    expect(access).not.toBe("all");
    if (access === "all") return;
    expect(access.has("suppliers")).toBe(false);
  });

  it("lands at /overview (supplier isolated overview; landingPath controls, ROLE_LANDING_PAGES kept sync'd)", async () => {
    expect(ROLE_LANDING_PAGES.supplier).toBe("/overview");
    const { landingPath } = await import("@/lib/routing/paths");
    expect(landingPath("supplier")).toBe("/supplier/overview");
    expect(landingPath("customer")).toBe("/customer/showroom");
  });
});
