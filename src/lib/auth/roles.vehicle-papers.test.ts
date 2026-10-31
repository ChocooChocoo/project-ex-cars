import { describe, expect, it } from "vitest";

import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

import { ROLE_NAV_ACCESS } from "./roles";

describe("vehicle papers navigation (T05)", () => {
  it("links the Vehicle Papers tab to /vehicle-papers", () => {
    const item = sidebarItems.flatMap((group) => group.items).find((navItem) => navItem.id === "vehicle-papers");
    expect(item?.title).toBe("Vehicle Papers");
    if (!item || !("url" in item)) throw new Error("Vehicle Papers must be a sidebar link.");
    expect(item.url).toBe("/vehicle-papers");
  });

  it.each(["confidential_informant", "ceo"] as const)("%s sees Vehicle Papers", (role) => {
    const access = ROLE_NAV_ACCESS[role];
    if (access === "all") return;
    expect(access.has("vehicle-papers")).toBe(true);
  });

  it("keeps Vehicle Papers out of the Sales Manager's sidebar", () => {
    const access = ROLE_NAV_ACCESS.sales_manager;
    if (access === "all") return;
    expect(access.has("vehicle-papers")).toBe(false);
  });
});
