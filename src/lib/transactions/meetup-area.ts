// Where a meet-up pin may sit: inside CALABARZON (Region IV-A) and nowhere else. No I/O.

import type { LatLng } from "./sell-flow";

/**
 * CALABARZON's rough bounding box: SW { 13.18, 120.56 }, NE { 15.10, 122.75 }. It also covers Metro Manila
 * (which Nominatim reports as `Metro Manila`) and a strip of the sea, so the bounds alone cannot accept a pin.
 */
export const CALABARZON_BOUNDS = {
  southWest: { lat: 13.18, lng: 120.56 },
  northEast: { lat: 15.1, lng: 122.75 },
} as const;

/** The same box in Leaflet's `[[south, west], [north, east]]` form, for `maxBounds`. */
export const CALABARZON_LEAFLET_BOUNDS: [[number, number], [number, number]] = [
  [CALABARZON_BOUNDS.southWest.lat, CALABARZON_BOUNDS.southWest.lng],
  [CALABARZON_BOUNDS.northEast.lat, CALABARZON_BOUNDS.northEast.lng],
];

/** What Nominatim calls the region; the PSGC list calls it `CALABARZON`. */
export const CALABARZON_REGION = "Calabarzon";

// ponytail: a bounding box plus the reverse-geocoded region string. It is a rectangle, so a pin in the sea or in
// Metro Manila passes it and only the region name catches it. Upgrade to a CALABARZON polygon if false accepts
// still appear (a pin inside the box whose Nominatim region is missing, e.g. far offshore).
export function isInCalabarzon(point: LatLng | null | undefined, geocodedRegion?: string | null): boolean {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  const { southWest, northEast } = CALABARZON_BOUNDS;
  if (point.lat < southWest.lat || point.lat > northEast.lat) return false;
  if (point.lng < southWest.lng || point.lng > northEast.lng) return false;
  // Before a geocode there is no region to check, so the box decides; after it, both must agree. An empty
  // region is an OSM data gap, not evidence against the pin, so it also falls back to the box.
  if (geocodedRegion == null || geocodedRegion.trim() === "") return true;

  return geocodedRegion.trim().toLowerCase() === CALABARZON_REGION.toLowerCase();
}

/** The nearest point inside the box, so a rejected pin can snap back onto the edge. */
export function clampToCalabarzon(point: LatLng): LatLng {
  const { southWest, northEast } = CALABARZON_BOUNDS;
  return {
    lat: Math.min(Math.max(point.lat, southWest.lat), northEast.lat),
    lng: Math.min(Math.max(point.lng, southWest.lng), northEast.lng),
  };
}

export function sameLatLng(a: LatLng | null | undefined, b: LatLng | null | undefined): boolean {
  return !!a && !!b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

/** The address a meet-up pin resolves to. Block and lot are typed: no geocoder knows them. */
export interface MeetupAddressParts {
  block_lot: string;
  barangay: string;
  city: string;
  province: string;
  region: string;
}

export function emptyMeetupAddress(): MeetupAddressParts {
  return { block_lot: "", barangay: "", city: "", province: "", region: "" };
}

/** The one line stored in `sell_details.meetup_address` / `purchase_details.meetup_address`. */
export function composeMeetupAddress(parts: MeetupAddressParts): string {
  return [parts.block_lot, parts.barangay, parts.city, parts.province, parts.region]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(", ");
}

/** `"lat, lng"` for a field case whose pin the workers read from the case pack. */
export function latLngLabel(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
