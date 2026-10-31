import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type AddressValue, emptyAddressValue } from "@/lib/psgc/address";

import { AddressFields } from "./address-fields";

const regions = [{ code: "040000000", name: "CALABARZON" }];
const provinces = [{ code: "043400000", name: "Laguna", regionCode: "040000000" }];
const cities = [{ code: "043405000", name: "City of Calamba", regionCode: "040000000", provinceCode: "043400000" }];
const barangays = [{ code: "043405001", name: "Bagong Kalsada" }];

function stubLists() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/psgc/regions")
        ? regions
        : url.includes("/psgc/provinces")
          ? provinces
          : url.includes("/psgc/cities")
            ? cities
            : barangays;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddressFields name resolution", () => {
  it("fills the names from the lists when the stored row only has codes", async () => {
    stubLists();
    const onChange = vi.fn();
    const value: AddressValue = {
      ...emptyAddressValue(),
      address_line: "Blk 4 Lot 2",
      region_code: "040000000",
      province_code: "043400000",
      city_code: "043405000",
      barangay_code: "043405001",
    };

    render(<AddressFields value={value} onChange={onChange} />);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange).toHaveBeenLastCalledWith({
      address_line: "Blk 4 Lot 2",
      region_code: "040000000",
      region_name: "CALABARZON",
      province_code: "043400000",
      province_name: "Laguna",
      city_code: "043405000",
      city_name: "City of Calamba",
      barangay_code: "043405001",
      barangay_name: "Bagong Kalsada",
    });
  });

  it("does not overwrite a name with an empty one", async () => {
    stubLists();
    const onChange = vi.fn();
    const value: AddressValue = {
      ...emptyAddressValue(),
      region_code: "040000000",
      region_name: "CALABARZON",
      province_code: "043400000",
      province_name: "Laguna",
      city_code: "043405000",
      city_name: "City of Calamba",
      barangay_code: "043405001",
      barangay_name: "Bagong Kalsada",
    };

    render(<AddressFields value={value} onChange={onChange} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onChange).not.toHaveBeenCalled();
  });
});
