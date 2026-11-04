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
      vin: "VIN-1",
      plate_number: "ABC 1234",
      engine_number: "ENG-9",
      chassis_number: "CHS-7",
    });
    expect(parsed.plate_number).toBe("ABC 1234");
    expect(parsed.engine_number).toBe("ENG-9");
    expect(parsed.chassis_number).toBe("CHS-7");
  });

  it("T06: requires all four identifiers", () => {
    const result = vehicleSchema.safeParse({ ...car, vin: " ", plate_number: "", engine_number: "E" });
    expect(result.success).toBe(false);
    const missing = result.error?.issues.map((issue) => issue.path[0]);
    expect(missing).toEqual(expect.arrayContaining(["vin", "plate_number", "chassis_number"]));
    expect(missing).not.toContain("engine_number");
  });
});
