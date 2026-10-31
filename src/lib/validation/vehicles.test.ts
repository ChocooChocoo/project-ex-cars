import { describe, expect, it } from "vitest";

import { vehicleSchema } from "./vehicles";

const car = {
  stock_code: "GCE-001",
  make: "Toyota",
  model: "Vios",
  year: "2022",
  condition: "used",
  pricing_type: "negotiable",
};

describe("vehicle identifiers on the vehicle form", () => {
  it("keeps the plate, engine and chassis numbers the Deed of Sale prints", () => {
    const parsed = vehicleSchema.parse({
      ...car,
      plate_number: "ABC 1234",
      engine_number: "ENG-9",
      chassis_number: "CHS-7",
    });
    expect(parsed.plate_number).toBe("ABC 1234");
    expect(parsed.engine_number).toBe("ENG-9");
    expect(parsed.chassis_number).toBe("CHS-7");
  });

  it("leaves them optional for cars already on the lot", () => {
    const parsed = vehicleSchema.parse(car);
    expect(parsed.plate_number).toBeUndefined();
    expect(parsed.engine_number).toBeUndefined();
    expect(parsed.chassis_number).toBeUndefined();
  });
});
