import { describe, expect, it } from "vitest";

import { vehicleSchema } from "./vehicles";

const base = {
  stock_code: "GCE-001",
  make: "Toyota",
  model: "Vios",
  year: "2022",
};

// The four identifiers are required, so a case that tests another field supplies them.
const car = {
  ...base,
  vin: "VIN-1",
  plate_number: "ABC 1234",
  engine_number: "ENG-9",
  chassis_number: "CHS-7",
};

describe("vehicle identifiers on the vehicle form", () => {
  it("keeps the plate, engine and chassis numbers the Deed of Sale prints", () => {
    const parsed = vehicleSchema.parse(car);
    expect(parsed.plate_number).toBe("ABC 1234");
    expect(parsed.engine_number).toBe("ENG-9");
    expect(parsed.chassis_number).toBe("CHS-7");
  });

  it("T06: requires all four identifiers", () => {
    const result = vehicleSchema.safeParse({ ...base, vin: " ", plate_number: "", engine_number: "E" });
    expect(result.success).toBe(false);
    const missing = result.error?.issues.map((issue) => issue.path[0]);
    expect(missing).toEqual(expect.arrayContaining(["vin", "plate_number", "chassis_number"]));
    expect(missing).not.toContain("engine_number");
  });
});

describe("SN-1: the posting form no longer asks for condition or warranty details", () => {
  it("has no condition key in the schema, so new rows keep the column default", () => {
    expect(Object.keys(vehicleSchema.shape)).not.toContain("condition");
    expect(vehicleSchema.parse(car)).not.toHaveProperty("condition");
  });

  it("has no warranty details key in the schema", () => {
    expect(Object.keys(vehicleSchema.shape)).not.toContain("warranty_details");
    expect(vehicleSchema.parse({ ...car, warranty_details: "1 year engine warranty" })).not.toHaveProperty(
      "warranty_details",
    );
  });
});

describe("BC-11: interior features on the posting form", () => {
  it("accepts the Marketing Specialist's description of the interior", () => {
    const parsed = vehicleSchema.parse({ ...car, interior_features: "Leather seats, 7 seats, rear AC" });
    expect(parsed.interior_features).toBe("Leather seats, 7 seats, rear AC");
  });

  it("leaves the field empty when the car has no interior description", () => {
    expect(vehicleSchema.parse(car).interior_features).toBeUndefined();
    expect(vehicleSchema.parse({ ...car, interior_features: "" }).interior_features).toBe("");
  });

  it("refuses more than 1000 characters", () => {
    const long = vehicleSchema.safeParse({ ...car, interior_features: "x".repeat(1001) });
    expect(long.error?.issues[0]?.message).toBe("Interior features must be at most 1000 characters.");
    expect(vehicleSchema.safeParse({ ...car, interior_features: "x".repeat(1000) }).success).toBe(true);
  });
});

describe("T11: per-car financing markup", () => {
  it("parses a markup typed into the form", () => {
    const parsed = vehicleSchema.parse({ ...car, financing_markup_pct: "12" });
    expect(parsed.financing_markup_pct).toBe(12);
  });

  it("allows a blank markup, which means the global rate applies", () => {
    const parsed = vehicleSchema.parse({ ...car, financing_markup_pct: "" });
    // Not 0: a blank field must not read as a deliberate 0% markup.
    expect(parsed.financing_markup_pct).toBe("");
  });

  it("leaves the markup undefined when the field is absent", () => {
    expect(vehicleSchema.parse(car).financing_markup_pct).toBeUndefined();
  });

  it("refuses a markup outside 0–100", () => {
    const negative = vehicleSchema.safeParse({ ...car, financing_markup_pct: "-1" });
    expect(negative.error?.issues[0]?.message).toBe("The markup cannot be negative.");
    const tooHigh = vehicleSchema.safeParse({ ...car, financing_markup_pct: "150" });
    expect(tooHigh.error?.issues[0]?.message).toBe("The markup cannot exceed 100%.");
  });
});
