import { describe, expect, it } from "vitest";

import { composeAddress, provinceNameFor } from "@/lib/psgc/address";

import { ownProfileSchema } from "./profile";

const complete = {
  full_name: "Juan Dela Cruz",
  phone: "09171234567",
  address_line: "Block 4 Lot 5",
  region_code: "040000000",
  region_name: "CALABARZON",
  province_code: "043400000",
  province_name: "Laguna",
  city_code: "043405000",
  city_name: "City of Calamba",
  barangay_code: "043405001",
  barangay_name: "Bagong Kalsada",
};

function firstError(values: Record<string, string>) {
  const result = ownProfileSchema.safeParse(values);
  return result.success ? null : result.error.issues[0]?.message;
}

describe("ownProfileSchema", () => {
  it("accepts a complete address with a province", () => {
    const parsed = ownProfileSchema.safeParse(complete);

    expect(parsed.success).toBe(true);
    expect(parsed.success && composeAddress({ ...parsed.data, province_name: provinceNameFor(parsed.data) })).toBe(
      "Block 4 Lot 5, Bagong Kalsada, City of Calamba, Laguna, CALABARZON",
    );
  });

  it("accepts an NCR address without a province", () => {
    const parsed = ownProfileSchema.safeParse({
      ...complete,
      province_code: "",
      province_name: "",
      region_code: "130000000",
      region_name: "NCR",
      city_code: "133900000",
      city_name: "City of Manila",
      barangay_code: "133901001",
      barangay_name: "Barangay 1",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && composeAddress({ ...parsed.data, province_name: provinceNameFor(parsed.data) })).toBe(
      "Block 4 Lot 5, Barangay 1, City of Manila, NCR",
    );
  });

  it("refuses an address with no barangay", () => {
    expect(firstError({ ...complete, barangay_code: "", barangay_name: "" })).toBe("Choose your barangay.");
    expect(firstError({ ...complete, barangay_code: "" })).toBe("Choose your barangay.");
  });

  it("refuses an address with no city", () => {
    expect(firstError({ ...complete, city_code: "" })).toBe("Choose your city or municipality.");
  });

  it("refuses an address with no region", () => {
    expect(firstError({ ...complete, region_code: "" })).toBe("Choose your region.");
  });

  it("refuses a code that is not a PSGC code", () => {
    expect(firstError({ ...complete, region_code: "04000" })).toBe("Choose your region.");
  });

  it("keeps block and lot optional but capped at 200 characters", () => {
    expect(ownProfileSchema.safeParse({ ...complete, address_line: "" }).success).toBe(true);
    expect(firstError({ ...complete, address_line: "x".repeat(201) })).toBe(
      "Block and lot must be at most 200 characters.",
    );
  });

  it("still trims the name and keeps phone optional", () => {
    const parsed = ownProfileSchema.safeParse({ ...complete, full_name: "  Juan Dela Cruz  ", phone: "" });

    expect(parsed.success && parsed.data.full_name).toBe("Juan Dela Cruz");
    expect(parsed.success && parsed.data.phone).toBe("");
  });
});
