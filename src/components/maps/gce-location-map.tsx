"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";

import { GCE_LOCATION, GCE_LOCATION_LABEL } from "@/lib/transactions/sell-flow";

/** BC-10: the small GCE-visit map is about this tall, everywhere it appears. */
export const GCE_LOCATION_MAP_HEIGHT = "h-[220px]";

// Plain HTML markers: Leaflet's default marker images do not resolve through the Next.js bundler.
function dotIcon(className: string, size: number) {
  return L.divIcon({
    className: "",
    html: `<span class="block rounded-full border-2 border-white shadow-md ${className}" style="width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const GCE_ICON = dotIcon("bg-amber-500", 16);

/**
 * BC-10: the read-only map of GCE's office for every GCE-visit arrangement. The marker is fixed; panning and
 * zooming are allowed. Loaded only through `next/dynamic` with `ssr: false`, like every Leaflet map.
 */
export function GceLocationMap({ height = GCE_LOCATION_MAP_HEIGHT }: { readonly height?: string }) {
  return (
    <MapContainer
      center={[GCE_LOCATION.lat, GCE_LOCATION.lng]}
      zoom={15}
      scrollWheelZoom={false}
      className={`z-0 w-full rounded-md border ${height}`}
      aria-label="GCE location map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[GCE_LOCATION.lat, GCE_LOCATION.lng]} icon={GCE_ICON} keyboard={false}>
        <Tooltip>{GCE_LOCATION_LABEL}</Tooltip>
      </Marker>
    </MapContainer>
  );
}
