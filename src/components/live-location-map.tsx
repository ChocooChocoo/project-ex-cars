"use client";

import { useEffect, useState } from "react";

import { getFieldCaseLocation } from "@/app/(staff)/field-cases/location-actions";

type Point = { lat: number; lng: number; at: string | null };

export function LiveLocationMap({
  fieldCaseId,
  initial = null,
  className,
}: {
  readonly fieldCaseId: string;
  readonly initial?: { lat: number | null; lng: number | null; at: string | null } | null;
  readonly className?: string;
}) {
  const [point, setPoint] = useState<Point | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng, at: initial.at } : null,
  );

  useEffect(() => {
    let active = true;
    async function refresh() {
      const result = await getFieldCaseLocation(fieldCaseId);
      if (!active || "error" in result) return;
      if (result.lat != null && result.lng != null) {
        setPoint({ lat: result.lat, lng: result.lng, at: result.at });
      }
    }
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fieldCaseId]);

  if (!point) {
    return (
      <p className={`text-muted-foreground text-xs ${className ?? ""}`}>
        Waiting for the Confidential Informant to share their location.
      </p>
    );
  }

  const delta = 0.01;
  const bbox = `${point.lng - delta},${point.lat - delta},${point.lng + delta},${point.lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${point.lat}%2C${point.lng}`;

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <iframe
        title="Confidential Informant live location"
        src={src}
        loading="lazy"
        className="h-56 w-full rounded-md border"
      />
      <p className="text-muted-foreground text-xs">
        {point.at ? `Last seen ${new Date(point.at).toLocaleString()}. ` : "Live location. "}
        <a
          href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-4"
        >
          Open in Google Maps
        </a>
      </p>
    </div>
  );
}
