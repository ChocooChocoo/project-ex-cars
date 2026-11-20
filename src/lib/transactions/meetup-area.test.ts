import { describe, expect, it } from "vitest";

import {
  CALABARZON_BOUNDS,
  CALABARZON_LEAFLET_BOUNDS,
  clampToCalabarzon,
  composeMeetupAddress,
  distanceKm,
  emptyMeetupAddress,
  isInCalabarzon,
  isNearMidpoint,
  latLngLabel,
  MEETUP_MAX_OFFSET_KM,
  sameLatLng,
} from "./meetup-area";
import { GCE_LOCATION } from "./sell-flow";

describe("SH-14 CALABARZON bounds", () => {
  it("is the agreed bounding box, also in Leaflet's order", () => {
    expect(CALABARZON_BOUNDS).toEqual({
      southWest: { lat: 13.18, lng: 120.56 },
      northEast: { lat: 15.1, lng: 122.75 },
    });
    expect(CALABARZON_LEAFLET_BOUNDS).toEqual([
      [13.18, 120.56],
      [15.1, 122.75],
    ]);
  });

  it("keeps GCE itself and Dasmariñas inside", () => {
    expect(isInCalabarzon(GCE_LOCATION)).toBe(true);
    expect(isInCalabarzon({ lat: 14.33, lng: 120.94 })).toBe(true);
  });

  it("rejects a pin in the sea, abroad, or north of the box", () => {
    expect(isInCalabarzon({ lat: 15.5, lng: 121 })).toBe(false);
    expect(isInCalabarzon({ lat: 10.3, lng: 123.9 })).toBe(false);
    expect(isInCalabarzon({ lat: 51.5, lng: -0.12 })).toBe(false);
    expect(isInCalabarzon(null)).toBe(false);
    expect(isInCalabarzon({ lat: Number.NaN, lng: 121 })).toBe(false);
  });

  it("accepts the box but rejects a geocoded region that is not Calabarzon", () => {
    // Metro Manila is inside the box, so only the reverse-geocoded region catches it.
    const manila = { lat: 14.5995, lng: 120.9842 };
    expect(isInCalabarzon(manila)).toBe(true);
    expect(isInCalabarzon(manila, "Metro Manila")).toBe(false);
    expect(isInCalabarzon(manila, "Calabarzon")).toBe(true);
    expect(isInCalabarzon(manila, " calabarzon ")).toBe(true);
    expect(isInCalabarzon(manila, "Central Luzon")).toBe(false);
  });

  it("clamps a rejected pin back onto the edge of the box", () => {
    expect(clampToCalabarzon({ lat: 20, lng: 121 })).toEqual({ lat: 15.1, lng: 121 });
    expect(clampToCalabarzon({ lat: 14.5, lng: 130 })).toEqual({ lat: 14.5, lng: 122.75 });
    expect(clampToCalabarzon({ lat: 14.5, lng: 121 })).toEqual({ lat: 14.5, lng: 121 });
  });
});

describe("meet-up address", () => {
  it("composes only the parts that were filled", () => {
    expect(composeMeetupAddress(emptyMeetupAddress())).toBe("");
    expect(
      composeMeetupAddress({
        block_lot: "Block 4 Lot 5",
        barangay: "Bagong Bayan",
        city: "Dasmariñas",
        province: "Cavite",
        region: "Calabarzon",
      }),
    ).toBe("Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon");
    expect(composeMeetupAddress({ ...emptyMeetupAddress(), city: "  Calamba  " })).toBe("Calamba");
  });

  it("formats a pin as the field case location and compares pins", () => {
    expect(latLngLabel({ lat: 14.32856, lng: 120.957 })).toBe("14.32856, 120.95700");
    expect(sameLatLng({ lat: 14.3, lng: 121 }, { lat: 14.3000001, lng: 121 })).toBe(true);
    expect(sameLatLng({ lat: 14.3, lng: 121 }, { lat: 14.4, lng: 121 })).toBe(false);
    expect(sameLatLng(null, { lat: 14.3, lng: 121 })).toBe(false);
  });
});

describe("meet-up pin radius (notes line 120)", () => {
  const midpoint = { lat: 14.3, lng: 121.0 };

  it("accepts a pin inside the radius and rejects one beyond it, even inside CALABARZON", () => {
    expect(MEETUP_MAX_OFFSET_KM).toBe(5);
    expect(isNearMidpoint({ lat: 14.33, lng: 121.0 }, midpoint)).toBe(true); // ~3.3 km
    const far = { lat: 14.4, lng: 121.0 }; // ~11 km, still in the box
    expect(isInCalabarzon(far)).toBe(true);
    expect(isNearMidpoint(far, midpoint)).toBe(false);
  });

  it("has no limit without a midpoint and measures great-circle km", () => {
    expect(isNearMidpoint({ lat: 13.5, lng: 122 }, null)).toBe(true);
    expect(distanceKm(midpoint, { lat: 14.4, lng: 121.0 })).toBeCloseTo(11.12, 1);
  });
});
