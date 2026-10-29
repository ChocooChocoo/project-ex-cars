"use client";
"use no memo";

import { useCallback, useRef, useState } from "react";

import Image from "next/image";

import { ChevronLeft, ChevronRight, RotateCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VehicleMediaKind } from "@/lib/vehicles/media-kinds";

export interface VehicleMediaItem {
  id: string;
  media_kind: VehicleMediaKind;
  storage_path: string;
  display_order: number;
}

type ViewerMode = "360" | "photo" | "interior";
const MODE_LABELS: Record<ViewerMode, string> = { "360": "360°", photo: "Gallery", interior: "Interior" };

const PUBLIC_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/showroom-media`;

function mediaUrl(storagePath: string): string {
  return `${PUBLIC_BUCKET_BASE}/${storagePath}`;
}

export function VehicleMediaViewer({ media }: { readonly media: VehicleMediaItem[] }) {
  const byOrder = (a: VehicleMediaItem, b: VehicleMediaItem) => a.display_order - b.display_order;
  const photos = media.filter((m) => m.media_kind === "photo");
  const interiors = media.filter((m) => m.media_kind === "interior").sort(byOrder);
  const spinFrames = media.filter((m) => m.media_kind === "360_view").sort(byOrder);

  // Interior is its own tab, shown only when the car has interior photos.
  const modes = (["360", "photo", "interior"] as const).filter((m) =>
    m === "360" ? spinFrames.length >= 3 : (m === "photo" ? photos : interiors).length > 0,
  );

  const [mode, setMode] = useState<ViewerMode>(modes[0] ?? "photo");
  const [photoIndex, setPhotoIndex] = useState(0);
  const slides = mode === "interior" ? interiors : photos;
  const [frame, setFrame] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartFrame = useRef(0);

  const has360 = spinFrames.length >= 3;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!has360) return;
      setDragging(true);
      dragStartX.current = e.clientX;
      dragStartFrame.current = frame;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [has360, frame],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const delta = e.clientX - dragStartX.current;
      const sensitivity = 60; // pixels per frame
      const frameDelta = Math.round(delta / sensitivity);
      const next = (dragStartFrame.current + frameDelta) % spinFrames.length;
      setFrame(next < 0 ? next + spinFrames.length : next);
    },
    [dragging, spinFrames.length],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  if (media.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted lg:col-span-2">
        <p className="text-muted-foreground">No vehicle images available yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:col-span-2">
      {mode === "360" && has360 ? (
        <div
          className="relative flex aspect-[4/3] touch-pan-y select-none items-center justify-center overflow-hidden rounded-lg bg-muted"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <Image
            src={mediaUrl(spinFrames[frame].storage_path)}
            alt=""
            draggable={false}
            unoptimized
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="pointer-events-none object-cover"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <Badge variant="secondary" className="rounded-md">
              <Sparkles className="size-3" />
              360° View
            </Badge>
          </div>
          <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-muted-foreground text-xs backdrop-blur">
            <RotateCw className="size-3" />
            Drag to rotate · {frame + 1}/{spinFrames.length}
          </div>
        </div>
      ) : (
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted">
          <Image
            src={mediaUrl(slides[photoIndex]?.storage_path ?? "")}
            alt=""
            unoptimized
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover"
          />
          {slides.length > 1 ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Previous photo"
                className="absolute top-1/2 left-2 -translate-y-1/2"
                onClick={() => setPhotoIndex((photoIndex - 1 + slides.length) % slides.length)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Next photo"
                className="absolute top-1/2 right-2 -translate-y-1/2"
                onClick={() => setPhotoIndex((photoIndex + 1) % slides.length)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      )}

      {modes.length > 1 ? (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border bg-background p-0.5">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                className={`min-h-11 rounded-md px-3 py-1 font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => {
                  setMode(m);
                  setPhotoIndex(0);
                }}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
