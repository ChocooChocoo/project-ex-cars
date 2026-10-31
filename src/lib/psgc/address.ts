// PSGC (Philippine Standard Geographic Code) address parts. The data behind these types is built once by
// `scripts/build-psgc.mjs` and served from /psgc/; nothing here talks to the network.

export interface PsgcRegion {
  code: string;
  name: string;
}

export interface PsgcProvince {
  code: string;
  name: string;
  regionCode: string;
}

export interface PsgcCity {
  code: string;
  name: string;
  regionCode: string;
  /** Null for a city or municipality that belongs to no province, such as every NCR city. */
  provinceCode: string | null;
}

export interface PsgcBarangay {
  code: string;
  name: string;
}

/** What the profile form holds and what `updateOwnProfile` writes, codes and names side by side. */
export interface AddressValue {
  address_line: string;
  region_code: string;
  region_name: string;
  province_code: string;
  province_name: string;
  city_code: string;
  city_name: string;
  barangay_code: string;
  barangay_name: string;
}

export function emptyAddressValue(): AddressValue {
  return {
    address_line: "",
    region_code: "",
    region_name: "",
    province_code: "",
    province_name: "",
    city_code: "",
    city_name: "",
    barangay_code: "",
    barangay_name: "",
  };
}

/** The one-line string kept in `profiles.address` for autofill and delivery. */
export function composeAddress(parts: Partial<Omit<AddressValue, "region_code">>): string {
  return [parts.address_line, parts.barangay_name, parts.city_name, parts.province_name, parts.region_name]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(", ");
}

export function provincesOfRegion(provinces: readonly PsgcProvince[], regionCode: string): PsgcProvince[] {
  if (!regionCode) return [];
  return provinces.filter((province) => province.regionCode === regionCode);
}

/**
 * Cities of a region. With a province chosen, only that province's cities; without one, only the cities
 * that belong to no province, which is how NCR works. A province-bound city therefore needs its province.
 */
export function citiesOfRegion(cities: readonly PsgcCity[], regionCode: string, provinceCode: string): PsgcCity[] {
  if (!regionCode) return [];
  return cities.filter(
    (city) =>
      city.regionCode === regionCode &&
      (provinceCode ? city.provinceCode === provinceCode : city.provinceCode === null),
  );
}

/** Compares the parts a buyer can pick. Names are derived from the PSGC lists, so they never make a form dirty. */
export function sameAddress(left: AddressValue, right: AddressValue): boolean {
  return (
    left.address_line === right.address_line &&
    left.region_code === right.region_code &&
    left.province_code === right.province_code &&
    left.city_code === right.city_code &&
    left.barangay_code === right.barangay_code
  );
}

// Each pick keeps the block and lot and clears every level below the one that changed, so a row never
// pairs a barangay with a city it does not belong to.
export function selectRegion(current: AddressValue, region: PsgcRegion): AddressValue {
  return {
    ...emptyAddressValue(),
    address_line: current.address_line,
    region_code: region.code,
    region_name: region.name,
  };
}

export function selectProvince(current: AddressValue, province: PsgcProvince): AddressValue {
  return {
    ...current,
    province_code: province.code,
    province_name: province.name,
    city_code: "",
    city_name: "",
    barangay_code: "",
    barangay_name: "",
  };
}

export function selectCity(current: AddressValue, city: PsgcCity): AddressValue {
  return {
    ...current,
    city_code: city.code,
    city_name: city.name,
    barangay_code: "",
    barangay_name: "",
  };
}

export function selectBarangay(current: AddressValue, barangay: PsgcBarangay): AddressValue {
  return { ...current, barangay_code: barangay.code, barangay_name: barangay.name };
}

/** Fills a province name only when a province code was chosen, so the composed line never invents one. */
export function provinceNameFor(value: AddressValue): string {
  return value.province_code ? value.province_name : "";
}
