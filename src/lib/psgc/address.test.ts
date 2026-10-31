import { describe, expect, it } from "vitest";

import {
  citiesOfRegion,
  composeAddress,
  emptyAddressValue,
  type PsgcCity,
  type PsgcProvince,
  provincesOfRegion,
  selectBarangay,
  selectCity,
  selectProvince,
  selectRegion,
} from "./address";

const provinces: PsgcProvince[] = [
  { code: "042100000", name: "Cavite", regionCode: "040000000" },
  { code: "043400000", name: "Laguna", regionCode: "040000000" },
];

const cities: PsgcCity[] = [
  { code: "043405000", name: "City of Calamba", regionCode: "040000000", provinceCode: "043400000" },
  { code: "042108000", name: "City of Bacoor", regionCode: "040000000", provinceCode: "042100000" },
  { code: "133900000", name: "City of Manila", regionCode: "130000000", provinceCode: null },
  { code: "137404000", name: "City of Mandaluyong", regionCode: "130000000", provinceCode: null },
];

describe("composeAddress", () => {
  it("joins block and lot, barangay, city, province and region in that order", () => {
    expect(
      composeAddress({
        address_line: "Block 4 Lot 5",
        barangay_name: "Bagong Kalsada",
        city_name: "City of Calamba",
        province_name: "Laguna",
        region_name: "CALABARZON",
      }),
    ).toBe("Block 4 Lot 5, Bagong Kalsada, City of Calamba, Laguna, CALABARZON");
  });

  it("skips the province when the region has none", () => {
    expect(
      composeAddress({
        address_line: "Unit 3B",
        barangay_name: "Barangay 1",
        city_name: "City of Manila",
        province_name: "",
        region_name: "NCR",
      }),
    ).toBe("Unit 3B, Barangay 1, City of Manila, NCR");
  });

  it("skips a blank block and lot and trims the parts", () => {
    expect(
      composeAddress({
        address_line: "   ",
        barangay_name: " Bagong Kalsada ",
        city_name: "City of Calamba",
        region_name: "CALABARZON",
      }),
    ).toBe("Bagong Kalsada, City of Calamba, CALABARZON");
  });
});

describe("provincesOfRegion", () => {
  it("lists the provinces of one region only", () => {
    expect(provincesOfRegion(provinces, "040000000").map((province) => province.name)).toEqual(["Cavite", "Laguna"]);
  });

  it("is empty for a region without provinces", () => {
    expect(provincesOfRegion(provinces, "130000000")).toEqual([]);
  });
});

describe("citiesOfRegion", () => {
  it("lists the cities of the chosen province", () => {
    expect(citiesOfRegion(cities, "040000000", "043400000").map((city) => city.name)).toEqual(["City of Calamba"]);
  });

  it("lists every city of a region without provinces", () => {
    expect(citiesOfRegion(cities, "130000000", "").map((city) => city.name)).toEqual([
      "City of Manila",
      "City of Mandaluyong",
    ]);
  });

  it("lists no province-bound city until a province is chosen", () => {
    expect(citiesOfRegion(cities, "040000000", "")).toEqual([]);
  });
});

describe("emptyAddressValue", () => {
  it("starts every part blank", () => {
    expect(Object.values(emptyAddressValue()).every((part) => part === "")).toBe(true);
  });
});

describe("cascading picks", () => {
  const filled = {
    ...emptyAddressValue(),
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

  it("keeps the block and lot but clears every lower level when the region changes", () => {
    const next = selectRegion(filled, { code: "130000000", name: "NCR" });

    expect(next.region_code).toBe("130000000");
    expect(next.region_name).toBe("NCR");
    expect(next.address_line).toBe("Block 4 Lot 5");
    expect([next.province_code, next.city_code, next.barangay_code]).toEqual(["", "", ""]);
    expect([next.province_name, next.city_name, next.barangay_name]).toEqual(["", "", ""]);
  });

  it("clears the city and barangay when the province changes", () => {
    const next = selectProvince(filled, { code: "042100000", name: "Cavite", regionCode: "040000000" });

    expect(next.province_code).toBe("042100000");
    expect([next.city_code, next.barangay_code]).toEqual(["", ""]);
    expect(next.address_line).toBe("Block 4 Lot 5");
  });

  it("clears the barangay when the city changes", () => {
    const next = selectCity(filled, {
      code: "042108000",
      name: "City of Bacoor",
      regionCode: "040000000",
      provinceCode: "042100000",
    });

    expect(next.city_code).toBe("042108000");
    expect(next.barangay_code).toBe("");
    expect(next.barangay_name).toBe("");
  });

  it("keeps the upper levels when the barangay changes", () => {
    const next = selectBarangay(filled, { code: "043405002", name: "Banadero" });

    expect(next).toEqual({ ...filled, barangay_code: "043405002", barangay_name: "Banadero" });
  });
});
