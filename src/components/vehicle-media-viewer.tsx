"use client";
"use no memo";

import { useEffect, useRef, useState } from "react";

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
  const has360 = spinFrames.length >= 3;

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
        <SpinViewer frames={spinFrames} />
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

/** The frame to show for a fractional rotation: nearest whole frame, wrapped into 0..count-1 (negative included). */
export function frameAt(pos: number, count: number): number {
  return ((Math.round(pos) % count) + count) % count;
}

const AUTO_SPIN_MS_PER_TURN = 12000;
const INERTIA_DECAY = 0.92;

// Every frame is mounted and loaded up front; rotating only changes opacity, so no frame ever blanks mid-spin.
function SpinViewer({ frames }: { readonly frames: VehicleMediaItem[] }) {
  const count = frames.length;
  const [pos, setPos] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const ready = loaded >= count;
  const stageRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const interacted = useRef(false);
  const drag = useRef<{ x: number; pos: number; lastX: number; lastT: number; v: number } | null>(null);

  const moveTo = (next: number) => {
    posRef.current = next;
    setPos(next);
  };
  const takeOver = () => {
    interacted.current = true;
    cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Slow turntable spin until the customer first touches the car.
  useEffect(() => {
    if (!ready || interacted.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now();
    const tick = (now: number) => {
      posRef.current += ((now - last) / AUTO_SPIN_MS_PER_TURN) * count;
      setPos(posRef.current);
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, count]);

  const framesPerPx = () => count / (stageRef.current?.clientWidth || 1);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    takeOver();
    drag.current = { x: e.clientX, pos: posRef.current, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const scale = framesPerPx();
    moveTo(d.pos + (e.clientX - d.x) * scale);
    d.v = ((e.clientX - d.lastX) * scale) / Math.max(1, e.timeStamp - d.lastT);
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    // A pause before release means the customer stopped on purpose: no coasting.
    let v = e.timeStamp - d.lastT > 80 ? 0 : d.v * 16;
    const coast = () => {
      if (Math.abs(v) < 0.002) return;
      moveTo(posRef.current + v);
      v *= INERTIA_DECAY;
      rafRef.current = requestAnimationFrame(coast);
    };
    rafRef.current = requestAnimationFrame(coast);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    takeOver();
    moveTo(Math.round(posRef.current) + (e.key === "ArrowRight" ? 1 : -1));
  };

  const shown = frameAt(pos, count);

  return (
    <div
      ref={stageRef}
      role="slider"
      aria-label="360° view. Drag or use arrow keys to rotate"
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={shown + 1}
      tabIndex={0}
      className={`relative flex aspect-[4/3] touch-pan-y select-none items-center justify-center overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ready ? "cursor-grab active:cursor-grabbing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      {frames.map((f, i) => (
        <Image
          key={f.id}
          src={mediaUrl(f.storage_path)}
          alt=""
          draggable={false}
          unoptimized
          fill
          loading="eager"
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="pointer-events-none object-cover"
          style={{ opacity: i === shown ? 1 : 0 }}
          onLoad={() => setLoaded((n) => n + 1)}
          onError={() => setLoaded((n) => n + 1)}
        />
      ))}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
        <Badge variant="secondary" className="rounded-md">
          <Sparkles className="size-3" />
          360° View
        </Badge>
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-muted-foreground text-xs backdrop-blur">
        <RotateCw className={`size-3 ${ready ? "" : "animate-spin"}`} />
        {ready ? `Drag to rotate · ${shown + 1}/${count}` : `Loading 360° · ${Math.min(loaded, count)}/${count}`}
      </div>
    </div>
  );
}
