import { describe, expect, it } from "vitest";

import { withoutIdentifiers } from "./identifiers";

describe("withoutIdentifiers", () => {
  it("drops the four identifiers and the per-car markup, and keeps the rest", () => {
    const car = {
      id: "1",
      make: "Toyota",
      vin: "V",
      plate_number: "P",
      engine_number: "E",
      chassis_number: "C",
      financing_markup_pct: "12.5",
    };
    expect(withoutIdentifiers(car)).toEqual({ id: "1", make: "Toyota" });
  });

  it("T11: never lets the financing markup reach a customer payload", () => {
    const stripped = withoutIdentifiers({ id: "1", make: "Toyota", financing_markup_pct: 10 });
    expect("financing_markup_pct" in stripped).toBe(false);
  });
});
