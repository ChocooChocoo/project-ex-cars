import { describe, expect, it } from "vitest";

import { withoutIdentifiers } from "./identifiers";

describe("withoutIdentifiers", () => {
  it("drops the four identifiers and keeps the rest", () => {
    const car = { id: "1", make: "Toyota", vin: "V", plate_number: "P", engine_number: "E", chassis_number: "C" };
    expect(withoutIdentifiers(car)).toEqual({ id: "1", make: "Toyota" });
  });
});
