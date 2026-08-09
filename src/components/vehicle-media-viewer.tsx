"use client";
"use no memo";

import { useCallback, useRef, useState } from "react";

import Image from "next/image";

import { ChevronLeft, ChevronRight, RotateCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface VehicleMediaItem {
  id: string;
  media_kind: "photo" | "360_view";
  storage_path: string;
  display_order: number;
}

const PUBLIC_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/showroom-media`;

function mediaUrl(storagePath: string): string {
  return `${PUBLIC_BUCKET_BASE}/${storagePath}`;
}

export function VehicleMediaViewer({ media }: { readonly media: VehicleMediaItem[] }) {
  const photos = media.filter((m) => m.media_kind === "photo");
  const spinFrames = media.filter((m) => m.media_kind === "360_view").sort((a, b) => a.display_order - b.display_order);

  const [mode, setMode] = useState<"photo" | "360">(spinFrames.length >= 3 ? "360" : "photo");
  const [photoIndex, setPhotoIndex] = useState(0);
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
            src={mediaUrl(photos[photoIndex]?.storage_path ?? "")}
            alt=""
            unoptimized
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover"
          />
          {photos.length > 1 ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1/2 left-2 -translate-y-1/2"
                onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1/2 right-2 -translate-y-1/2"
                onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      )}

      {has360 && photos.length > 0 ? (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border bg-background p-0.5">
            <button
              type="button"
              className={`rounded-md px-3 py-1 font-medium text-xs ${mode === "360" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setMode("360")}
            >
              360°
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 font-medium text-xs ${mode === "photo" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setMode("photo")}
            >
              Gallery
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
