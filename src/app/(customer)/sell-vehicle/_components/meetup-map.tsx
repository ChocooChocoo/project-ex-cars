"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useState } from "react";

import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

import { Button } from "@/components/ui/button";
import { GCE_LOCATION, halfwayPoint, type LatLng } from "@/lib/transactions/sell-flow";

// Plain HTML markers: Leaflet's default marker images do not resolve through the Next.js bundler.
function dotIcon(className: string, size: number) {
  return L.divIcon({
    className: "",
    html: `<span class="block rounded-full border-2 border-white shadow-md ${className}" style="width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const GCE_ICON = dotIcon("bg-amber-500", 14);
const CLIENT_ICON = dotIcon("bg-sky-600", 14);
const PIN_ICON = dotIcon("bg-primary ring-4 ring-primary/30", 22);

type LocateState = "locating" | "found" | "unavailable" | "moved";

// Moves the view when the suggested point is recalculated, so the pin is always on screen.
function FitPoints({ points }: { readonly points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit only when the points themselves change
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 14 });
  }, [key, map]);
  return null;
}

/**
 * T12: suggests the halfway point between GCE and the seller's device location and lets the seller drag the
 * pin. Without a device location the pin starts at GCE.
 */
export function MeetupMap({ onChange }: { readonly onChange: (point: LatLng) => void }) {
  const [client, setClient] = useState<LatLng | null>(null);
  const [pin, setPin] = useState<LatLng>(GCE_LOCATION);
  const [state, setState] = useState<LocateState>("locating");

  function place(point: LatLng) {
    setPin(point);
    onChange(point);
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      place(GCE_LOCATION);
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        setClient(here);
        setState("found");
        place(halfwayPoint(GCE_LOCATION, here));
      },
      () => {
        setState("unavailable");
        place(GCE_LOCATION);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: ask for the location once, when the map opens
  useEffect(() => {
    locate();
  }, []);

  const fitTo = client ? [GCE_LOCATION, client] : [GCE_LOCATION];

  return (
    <div className="flex flex-col gap-2">
      <MapContainer
        center={GCE_LOCATION}
        zoom={12}
        scrollWheelZoom={false}
        className="z-0 h-72 w-full rounded-md border"
        aria-label="Meet-up point map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPoints points={fitTo} />
        <Marker position={GCE_LOCATION} icon={GCE_ICON} keyboard={false}>
          <Tooltip>GCE, Dasmariñas, Cavite</Tooltip>
        </Marker>
        {client ? (
          <Marker position={client} icon={CLIENT_ICON} keyboard={false}>
            <Tooltip>Your location</Tooltip>
          </Marker>
        ) : null}
        <Marker
          position={pin}
          icon={PIN_ICON}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              setState("moved");
              place({ lat, lng });
            },
          }}
        >
          <Tooltip>Meet-up point. Drag to move it.</Tooltip>
        </Marker>
      </MapContainer>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs" aria-label="Map legend">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" aria-hidden="true" />
          GCE
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-sky-600" aria-hidden="true" />
          You
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary ring-2 ring-primary/30" aria-hidden="true" />
          Meet-up point (drag to move)
        </li>
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-muted-foreground" aria-live="polite">
          {state === "locating" && "Finding your location…"}
          {state === "found" && "Pin set halfway between GCE and you. "}
          {state === "moved" && "You moved the pin. "}
          {state === "unavailable" &&
            "Location unavailable. Allow location access, or drag the pin to the meet-up spot. "}
          {state !== "locating" && `Pin: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={locate} disabled={state === "locating"}>
          <LocateFixed className="size-4" />
          Use my location again
        </Button>
      </div>
    </div>
  );
}
