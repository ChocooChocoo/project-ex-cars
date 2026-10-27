"use client";

import { useEffect, useRef, useState } from "react";

import { format } from "date-fns";

import { updateDeliveryLocation } from "@/app/(staff)/field-cases/delivery-actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const SEND_EVERY_MS = 60_000;

// T03 D1: the delivery team shares its position while the car is on the road, at most once a minute.
// The parent renders this only while the status is In Transit or Arriving, so marking Delivered unmounts it
// and stops the watch.
export function ShareLocation({ fieldCaseId }: { readonly fieldCaseId: string }) {
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!sharing) return;

    async function send(position: GeolocationPosition) {
      setMessage(null);
      if (Date.now() - lastSentAt.current < SEND_EVERY_MS) return;
      lastSentAt.current = Date.now();
      const result = await updateDeliveryLocation(fieldCaseId, position.coords.latitude, position.coords.longitude);
      if ("error" in result) {
        setMessage(result.error);
        setSharing(false);
      } else {
        setLastSent(new Date());
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void send(position);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setMessage(
            "Location access is blocked. Allow location for this site in your browser settings, then try again.",
          );
          setSharing(false);
        } else {
          setMessage("Your location is not available right now. Sharing stays on and tries again.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharing, fieldCaseId]);

  function toggle(on: boolean) {
    if (on && !("geolocation" in navigator)) {
      setMessage("This browser cannot share location.");
      return;
    }
    setMessage(null);
    lastSentAt.current = 0;
    setSharing(on);
  }

  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <div className="flex items-center gap-2">
        <Switch id="share-location" checked={sharing} onCheckedChange={toggle} />
        <Label htmlFor="share-location">Share my location</Label>
      </div>
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {sharing
          ? lastSent
            ? `Sharing. Last sent ${format(lastSent, "h:mm a")}; updates once a minute.`
            : "Sharing. Waiting for your position."
          : "Staff and the buyer see your last position on a map link."}
      </p>
      {message ? (
        <p role="alert" className="text-destructive text-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
}
