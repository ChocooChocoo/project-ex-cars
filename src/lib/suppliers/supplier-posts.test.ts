import { describe, expect, it } from "vitest";

import {
  isActiveSupplierPost,
  SUPPLIER_POST_STATE_LABELS,
  SUPPLIER_POST_STATES,
  supplierPostTitle,
} from "./supplier-posts";

describe("supplier posts (notes Part 1)", () => {
  it("labels every state the supplier_vehicle_posts CHECK allows", () => {
    expect(Object.keys(SUPPLIER_POST_STATE_LABELS)).toEqual([...SUPPLIER_POST_STATES]);
  });

  it("moves a purchased, rejected or withdrawn post out of the active list", () => {
    expect(isActiveSupplierPost({ state: "posted" })).toBe(true);
    expect(isActiveSupplierPost({ state: "assigned" })).toBe(true);
    for (const state of ["purchased", "rejected", "withdrawn"] as const)
      expect(isActiveSupplierPost({ state })).toBe(false);
  });

  it("names a post by year, make and model", () => {
    expect(supplierPostTitle({ year: 2019, make: "Toyota", model: "Vios" })).toBe("2019 Toyota Vios");
  });
});
