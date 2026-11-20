"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";

import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reverseGeocode } from "@/lib/maps/reverse-geocode";
import {
  CALABARZON_LEAFLET_BOUNDS,
  clampToCalabarzon,
  isInCalabarzon,
  type MeetupAddressParts,
} from "@/lib/transactions/meetup-area";
import { GCE_LOCATION, GCE_LOCATION_LABEL, halfwayPoint, type LatLng } from "@/lib/transactions/sell-flow";

/** BC-10 asks for a small in-app map; every meet-up map stays this tall. */
export const MEETUP_MAP_HEIGHT = "h-56";

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
 * The one shared meet-up map (SH-14 / BH-8). GCE is pinned on DLSU-D Gate 3; the pin starts halfway between GCE
 * and the viewer's device and may only be dragged inside CALABARZON. The reverse geocode that fills the address
 * runs on `dragend` and once when the editable pin is placed from the device location.
 *
 * Leaflet needs `window`, so this file is loaded only through `next/dynamic` with `ssr: false`.
 */
export function MeetupMap({
  value = null,
  onChange,
  onAddress,
  editable = true,
  showGce = true,
  height = MEETUP_MAP_HEIGHT,
}: {
  readonly value?: LatLng | null;
  readonly onChange?: (point: LatLng) => void;
  /** The reverse-geocoded Region / Province / City / Barangay; null when the lookup failed. */
  readonly onAddress?: (address: MeetupAddressParts | null) => void;
  readonly editable?: boolean;
  readonly showGce?: boolean;
  readonly height?: string;
}) {
  const [client, setClient] = useState<LatLng | null>(null);
  const [pin, setPin] = useState<LatLng>(value ?? GCE_LOCATION);
  const [state, setState] = useState<"locating" | "found" | "unavailable" | "moved">(value ? "moved" : "locating");
  const [looking, setLooking] = useState(false);
  // The last point that passed both checks, so a drop in Metro Manila goes back there instead.
  const lastValid = useRef<LatLng>(value ?? GCE_LOCATION);

  function place(point: LatLng) {
    setPin(point);
    onChange?.(point);
  }

  // Called from dragend and once per device locate: the Nominatim budget is one request a second (throttled in
  // reverse-geocode.ts), and a read-only map makes none.
  // `previous` is the last accepted point; it stays the form's value until this candidate passes both gates.
  async function geocode(point: LatLng, previous: LatLng): Promise<boolean> {
    setLooking(true);
    const result = await reverseGeocode(point.lat, point.lng);
    setLooking(false);
    // SH-14: the box also covers Metro Manila and the sea, so the reverse-geocoded region is the second gate.
    if (result && !isInCalabarzon(point, result.region)) {
      toast.error(`That point is in ${result.region || "an unknown region"}, not CALABARZON. The pin was moved back.`);
      place(previous);
      onAddress?.(null);
      return false;
    }
    // Accepted (a failed lookup keeps the coordinates; the user types the block and lot instead).
    lastValid.current = point;
    if (!result) {
      toast.error("We could not look up that address. Type the block and lot instead.");
      onAddress?.(null);
      return true;
    }
    onAddress?.(result.parts);
    return true;
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
        const suggested = halfwayPoint(GCE_LOCATION, here);
        // A device location outside CALABARZON starts the pin at GCE; it can still be dragged from there.
        const start = isInCalabarzon(suggested) ? suggested : GCE_LOCATION;
        lastValid.current = start;
        place(start);
        // BH-8: fill the address for the suggested pin too (one lookup per locate), so the buyer only drags when
        // the halfway point is not where they want to meet.
        if (editable) void geocode(start, GCE_LOCATION);
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
    if (!value) locate();
  }, []);

  useEffect(() => {
    if (value) {
      setPin(value);
      lastValid.current = value;
    }
  }, [value]);

  function handleDragEnd(marker: L.Marker) {
    const moved = marker.getLatLng();
    const point = { lat: moved.lat, lng: moved.lng };
    if (!isInCalabarzon(point)) {
      // Snap the pin itself back inside, so the rejected point never reaches the form or the API.
      const inside = clampToCalabarzon(point);
      marker.setLatLng([inside.lat, inside.lng]);
      lastValid.current = inside;
      setState("moved");
      place(inside);
      toast.error("Meet-ups must be inside CALABARZON. The pin was moved back inside.");
      return;
    }
    // The bbox alone also covers Metro Manila and the sea, so the candidate only becomes the saved value
    // once the reverse-geocoded region agrees. `previous` is what a rejection snaps back to.
    const previous = lastValid.current;
    setState("moved");
    place(point);
    void geocode(point, previous).then((accepted) => {
      if (!accepted) marker.setLatLng([previous.lat, previous.lng]);
    });
  }

  const fitTo = client ? [GCE_LOCATION, client] : [GCE_LOCATION];

  return (
    <div className="flex flex-col gap-2">
      <MapContainer
        center={[pin.lat, pin.lng]}
        zoom={12}
        scrollWheelZoom={false}
        maxBounds={CALABARZON_LEAFLET_BOUNDS}
        maxBoundsViscosity={1}
        className={`z-0 w-full rounded-md border ${height}`}
        aria-label="Meet-up point map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPoints points={fitTo} />
        {showGce ? (
          <Marker position={GCE_LOCATION} icon={GCE_ICON} keyboard={false}>
            <Tooltip>{GCE_LOCATION_LABEL}</Tooltip>
          </Marker>
        ) : null}
        {client ? (
          <Marker position={client} icon={CLIENT_ICON} keyboard={false}>
            <Tooltip>Your location</Tooltip>
          </Marker>
        ) : null}
        <Marker
          position={pin}
          icon={PIN_ICON}
          keyboard={false}
          draggable={editable}
          eventHandlers={
            editable
              ? {
                  dragend: (event) => {
                    handleDragEnd(event.target as L.Marker);
                  },
                }
              : undefined
          }
        >
          <Tooltip>{editable ? "Meet-up point. Drag to move it." : "Meet-up point"}</Tooltip>
        </Marker>
      </MapContainer>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs" aria-label="Map legend">
        {showGce ? (
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-500" aria-hidden="true" />
            GCE, DLSU-D Gate 3
          </li>
        ) : null}
        {client ? (
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-sky-600" aria-hidden="true" />
            You
          </li>
        ) : null}
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary ring-2 ring-primary/30" aria-hidden="true" />
          {editable ? "Meet-up point (drag to move)" : "Meet-up point"}
        </li>
      </ul>
      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-muted-foreground" aria-live="polite">
            {state === "locating" && "Finding your location…"}
            {state === "found" && "Pin set halfway between GCE and you. "}
            {state === "moved" && "Pin set. "}
            {state === "unavailable" &&
              "Location unavailable. Allow location access, or drag the pin to the meet-up spot. "}
            {looking ? "Looking up the address… " : null}
            {state !== "locating" && `Pin: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={locate} disabled={state === "locating"}>
            <LocateFixed className="size-4" />
            Use my location again
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
