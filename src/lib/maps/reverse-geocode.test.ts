import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearReverseGeocodeCache,
  mapNominatimAddress,
  NOMINATIM_ENDPOINT,
  NOMINATIM_MIN_INTERVAL_MS,
  nominatimUrl,
  reverseGeocode,
} from "./reverse-geocode";

const emptyAddress = { block_lot: "", barangay: "", city: "", province: "", region: "" };

// The GCE pin and a Metro Manila point, as Nominatim answers them (trimmed to the fields the map reads).
const GCE_RESPONSE = {
  display_name: "DLSU-D Gate 3, Governor Dominador Mangubat Boulevard, Bagong Bayan, Dasmariñas, Cavite, Calabarzon",
  address: {
    highway: "DLSU-D Gate 3",
    road: "Governor Dominador Mangubat Boulevard",
    suburb: "Bagong Bayan",
    city: "Dasmariñas",
    state: "Cavite",
    region: "Calabarzon",
    country: "Philippines",
  },
};

const MANILA_RESPONSE = {
  display_name: "JG Plaza, P. Paterno Street, Quiapo, Manila, Metro Manila",
  address: {
    road: "P. Paterno Street",
    suburb: "Quiapo",
    city: "Manila",
    region: "Metro Manila",
    country: "Philippines",
  },
};

describe("nominatimUrl", () => {
  it("asks for jsonv2 with the address details at zoom 18", () => {
    const url = new URL(nominatimUrl(14.32856, 120.957));
    expect(`${url.origin}${url.pathname}`).toBe(NOMINATIM_ENDPOINT);
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("lat")).toBe("14.32856");
    expect(url.searchParams.get("lon")).toBe("120.957");
    expect(url.searchParams.get("zoom")).toBe("18");
    expect(url.searchParams.get("addressdetails")).toBe("1");
  });
});

describe("mapNominatimAddress", () => {
  it("maps region, province, city and barangay", () => {
    expect(mapNominatimAddress(GCE_RESPONSE.address)).toEqual({
      block_lot: "Governor Dominador Mangubat Boulevard",
      barangay: "Bagong Bayan",
      city: "Dasmariñas",
      province: "Cavite",
      region: "Calabarzon",
    });
  });

  it("falls back through province/county, town/municipality and village/quarter", () => {
    expect(
      mapNominatimAddress({ county: "Laguna", town: "Los Baños", village: "Batong Malake", region: "Calabarzon" }),
    ).toEqual({
      block_lot: "",
      barangay: "Batong Malake",
      city: "Los Baños",
      province: "Laguna",
      region: "Calabarzon",
    });
    expect(mapNominatimAddress(null)).toEqual(emptyAddress);
  });
});

describe("reverseGeocode", () => {
  beforeEach(() => {
    clearReverseGeocodeCache();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the mapped address and the region", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => GCE_RESPONSE })),
    );
    const result = await reverseGeocode(14.32856, 120.957);
    expect(result?.region).toBe("Calabarzon");
    expect(result?.parts.city).toBe("Dasmariñas");
    expect(result?.parts.barangay).toBe("Bagong Bayan");
  });

  it("answers null when Nominatim fails, so the form keeps the coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    expect(await reverseGeocode(14.5, 121)).toBeNull();

    // The policy is one request a second, so each case below starts a fresh second rather than sleeping.
    clearReverseGeocodeCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    expect(await reverseGeocode(14.6, 121)).toBeNull();

    clearReverseGeocodeCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ error: "Unable to geocode" }) })),
    );
    expect(await reverseGeocode(14.7, 121)).toBeNull();
  });

  it("keeps the Nominatim budget at one request per second", () => {
    expect(NOMINATIM_MIN_INTERVAL_MS).toBe(1000);
  });

  it("caches a point, so dragging back to it costs no request", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => MANILA_RESPONSE }));
    vi.stubGlobal("fetch", fetchMock);
    await reverseGeocode(14.5995, 120.9842);
    await reverseGeocode(14.5995, 120.9842);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await reverseGeocode(14.5995, 120.9842))?.region).toBe("Metro Manila");
  });
});
