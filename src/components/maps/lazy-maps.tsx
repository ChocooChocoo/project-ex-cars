"use client";

// Leaflet needs `window` and its own CSS, so every map is loaded through `next/dynamic` with `ssr: false`
// (the old meetup-map.tsx rule). These wrappers are the only place the map modules are imported from, which
// keeps jsdom unit tests from ever importing Leaflet eagerly.

import dynamic from "next/dynamic";

import type { MeetupAddressParts } from "@/lib/transactions/meetup-area";
import type { LatLng } from "@/lib/transactions/sell-flow";

const MAP_SKELETON = <div className="h-56 w-full animate-pulse rounded-md border bg-muted" />;

const LazyMeetupMap = dynamic(() => import("./meetup-map").then((mod) => mod.MeetupMap), {
  ssr: false,
  loading: () => MAP_SKELETON,
});

const LazyGceLocationMap = dynamic(() => import("./gce-location-map").then((mod) => mod.GceLocationMap), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-md border bg-muted" />,
});

/** The draggable CALABARZON meet-up map. */
export function MeetupMap(props: {
  readonly value?: LatLng | null;
  readonly onChange?: (point: LatLng) => void;
  readonly onAddress?: (address: MeetupAddressParts | null) => void;
  readonly editable?: boolean;
  readonly showGce?: boolean;
  readonly height?: string;
  readonly origin?: LatLng | null;
  readonly onOrigin?: (point: LatLng) => void;
}) {
  return <LazyMeetupMap {...props} />;
}

/** BC-10: the read-only map of GCE's office. */
export function GceLocationMap(props: { readonly height?: string }) {
  return <LazyGceLocationMap {...props} />;
}
