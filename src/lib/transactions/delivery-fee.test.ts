import { describe, expect, it } from "vitest";

import {
  DELIVERY_FEE_RANGES,
  deliveryArea,
  deliveryFeeRangeLabel,
  downPaymentFor,
  feeWithinRange,
} from "./delivery-fee";

describe("deliveryArea", () => {
  it("reads the area from the first two digits of the PSGC region code", () => {
    expect(deliveryArea("040000000")).toBe("calabarzon");
    expect(deliveryArea("130000000")).toBe("luzon");
    expect(deliveryArea("070000000")).toBe("visayas");
    expect(deliveryArea("110000000")).toBe("mindanao");
  });

  it("puts every Luzon region outside CALABARZON in Luzon", () => {
    for (const code of ["010000000", "020000000", "030000000", "050000000", "140000000", "170000000"]) {
      expect(deliveryArea(code)).toBe("luzon");
    }
    expect(deliveryArea("040000000")).toBe("calabarzon");
  });

  it("puts the Negros Island Region in Visayas", () => {
    expect(deliveryArea("180000000")).toBe("visayas");
  });

  it("puts BARMM and Caraga in Mindanao", () => {
    expect(deliveryArea("150000000")).toBe("mindanao");
    expect(deliveryArea("160000000")).toBe("mindanao");
  });

  it("answers null without a usable region code", () => {
    expect(deliveryArea(null)).toBeNull();
    expect(deliveryArea(undefined)).toBeNull();
    expect(deliveryArea("")).toBeNull();
    expect(deliveryArea("not-a-code")).toBeNull();
    expect(deliveryArea("990000000")).toBeNull();
  });
});

describe("DELIVERY_FEE_RANGES", () => {
  it("marks CALABARZON free and prices the other areas as agreed", () => {
    expect(DELIVERY_FEE_RANGES.calabarzon).toEqual({ min: 0, max: 0 });
    expect(DELIVERY_FEE_RANGES.luzon).toEqual({ min: 8_000, max: 10_000 });
    expect(DELIVERY_FEE_RANGES.visayas).toEqual({ min: 10_000, max: 15_000 });
    expect(DELIVERY_FEE_RANGES.mindanao).toEqual({ min: 15_000, max: 20_000 });
  });

  it("refuses a Visayas fee of ₱9,000 and accepts one inside the range", () => {
    expect(feeWithinRange("visayas", 9_000)).toBe(false);
    expect(feeWithinRange("visayas", 10_000)).toBe(true);
    expect(feeWithinRange("visayas", 15_000)).toBe(true);
    expect(feeWithinRange("visayas", 15_001)).toBe(false);
  });

  it("keeps a CALABARZON delivery at zero", () => {
    expect(feeWithinRange("calabarzon", 0)).toBe(true);
    expect(feeWithinRange("calabarzon", 1_000)).toBe(false);
  });
});

describe("deliveryFeeRangeLabel", () => {
  it("writes the free range and the peso ranges the buyer reads", () => {
    expect(deliveryFeeRangeLabel("calabarzon")).toBe("Free delivery");
    expect(deliveryFeeRangeLabel("luzon")).toBe("₱8,000 – ₱10,000");
    expect(deliveryFeeRangeLabel("visayas")).toBe("₱10,000 – ₱15,000");
    expect(deliveryFeeRangeLabel("mindanao")).toBe("₱15,000 – ₱20,000");
  });
});

describe("downPaymentFor", () => {
  it("takes 10% of the vehicle price", () => {
    expect(downPaymentFor(500_000)).toBe(50_000);
    expect(downPaymentFor(0)).toBe(0);
  });

  it("rounds to the nearest peso", () => {
    expect(downPaymentFor(12_345)).toBe(1_235);
    expect(downPaymentFor(199)).toBe(20);
    expect(downPaymentFor(1)).toBe(0);
  });
});
