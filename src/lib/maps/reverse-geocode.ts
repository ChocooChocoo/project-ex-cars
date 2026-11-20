// OSM Nominatim reverse geocoding for a meet-up pin. The usage policy allows at most one request per second,
// so every lookup waits out that budget; a point already looked up is cached for the session.

import { emptyMeetupAddress, type MeetupAddressParts } from "@/lib/transactions/meetup-area";

export const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

/** Nominatim's policy: never more than one request a second. */
export const NOMINATIM_MIN_INTERVAL_MS = 1000;

export interface NominatimAddress {
  readonly region?: string | null;
  readonly state?: string | null;
  readonly state_district?: string | null;
  readonly province?: string | null;
  readonly county?: string | null;
  readonly city?: string | null;
  readonly municipality?: string | null;
  readonly town?: string | null;
  readonly suburb?: string | null;
  readonly village?: string | null;
  readonly quarter?: string | null;
  readonly neighbourhood?: string | null;
  readonly road?: string | null;
  readonly house_number?: string | null;
}

export interface ReverseGeocodeResult {
  /** The one-line name Nominatim gives the point. */
  displayName: string;
  /** The region the pin sits in, e.g. "Calabarzon" or "Metro Manila". */
  region: string;
  /** Region / Province / City-Municipality / Barangay, already mapped to their display names. */
  parts: MeetupAddressParts;
}

export function nominatimUrl(lat: number, lng: number): string {
  const query = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    zoom: "18",
    addressdetails: "1",
  });

  return `${NOMINATIM_ENDPOINT}?${query.toString()}`;
}

/** state/region, province/county, city/town/municipality, suburb/village/quarter, in that order. */
export function mapNominatimAddress(address: NominatimAddress | null | undefined): MeetupAddressParts {
  if (!address) return emptyMeetupAddress();
  const first = (values: ReadonlyArray<string | null | undefined>) =>
    values.map((value) => value?.trim() ?? "").find((value) => value.length > 0) ?? "";

  return {
    // Geocoding cannot give a block and lot reliably: this is only the nearest hint, and the field is typed.
    block_lot: [address.house_number, address.road]
      .map((part) => part?.trim() ?? "")
      .filter((part) => part.length > 0)
      .join(" "),
    barangay: first([address.suburb, address.village, address.quarter, address.neighbourhood]),
    city: first([address.city, address.town, address.municipality]),
    province: first([address.province, address.state, address.county]),
    region: first([address.region, address.state_district]),
  };
}

// A session cache: dragging the pin back to a spot already looked up costs no request. Failures are cached too,
// so a point Nominatim has nothing for does not cost a request on every drag.
const cache = new Map<string, ReverseGeocodeResult | null>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

// One chain for every caller: two drags in the same tick would otherwise both read a stale `lastRequestAt`,
// skip the wait and spend the Nominatim budget at once.
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Reverse geocodes one point, at most once a second. */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key) ?? null;

  const request = queue.then(async () => {
    // Stamp before waiting, so the next caller in the chain measures from this request's start.
    const wait = lastRequestAt + NOMINATIM_MIN_INTERVAL_MS - Date.now();
    lastRequestAt = Math.max(Date.now(), lastRequestAt + NOMINATIM_MIN_INTERVAL_MS);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    try {
      const response = await fetch(nominatimUrl(lat, lng), { headers: { Accept: "application/json" } });
      if (!response.ok) {
        cache.set(key, null);
        return null;
      }
      const body = (await response.json()) as {
        display_name?: string;
        address?: NominatimAddress;
        error?: string;
      };
      if (body.error) {
        cache.set(key, null);
        return null;
      }
      const result: ReverseGeocodeResult = {
        displayName: body.display_name ?? "",
        region: body.address?.region?.trim() ?? "",
        parts: mapNominatimAddress(body.address),
      };
      cache.set(key, result);

      return result;
    } catch {
      cache.set(key, null);
      return null;
    }
  });
  queue = request.catch(() => undefined);

  return request;
}

/** Testing hook: forget every cached point and the throttle. */
export function clearReverseGeocodeCache(): void {
  cache.clear();
  queue = Promise.resolve();
  lastRequestAt = 0;
}
