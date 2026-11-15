"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";

// A plain canvas the buyer draws on with a finger, pen or mouse.
export function SignaturePad({ onChange }: { readonly onChange: (canvas: HTMLCanvasElement | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) * canvas.width) / rect.width,
      ((event.clientY - rect.top) * canvas.height) / rect.height,
    ] as const;
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        role="img"
        aria-label="Signature pad: draw your signature"
        className="h-36 w-full touch-none rounded-md border bg-background"
        onPointerDown={(event) => {
          const context = event.currentTarget.getContext("2d");
          if (!context) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          context.lineWidth = 2.5;
          context.lineCap = "round";
          context.strokeStyle = getComputedStyle(event.currentTarget).color;
          context.beginPath();
          context.moveTo(...point(event));
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const context = event.currentTarget.getContext("2d");
          context?.lineTo(...point(event));
          context?.stroke();
        }}
        onPointerUp={(event) => {
          if (!drawing.current) return;
          drawing.current = false;
          onChange(event.currentTarget);
        }}
      />
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={clear}>
        Clear signature
      </Button>
    </div>
  );
}
