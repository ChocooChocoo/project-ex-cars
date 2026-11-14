"use client";

import { useState } from "react";

import Image from "next/image";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Every submitted image opens in a larger view when clicked.
export function TransactionImagePreview({
  src,
  alt,
  className,
  triggerClassName = "h-48 w-full",
}: {
  readonly src: string;
  readonly alt: string;
  readonly className?: string;
  /** Size of the clickable thumbnail; tables pass a small one. */
  readonly triggerClassName?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Open ${alt} in a larger view`}
        className={`relative block shrink-0 cursor-zoom-in overflow-hidden rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${triggerClassName}`}
      >
        {failedSrc === src ? (
          <span className="text-muted-foreground text-xs">Preview unavailable</span>
        ) : (
          <Image
            src={`/api/transaction-thumbnail?src=${encodeURIComponent(src)}`}
            alt={alt}
            fill
            // The thumbnail endpoint resizes privately; Next's public image cache must not retain signed documents.
            unoptimized
            loading="lazy"
            decoding="async"
            className={className ?? "object-contain"}
            onError={() => setFailedSrc(src)}
          />
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative h-[min(80vh,48rem)] w-full">
          {open ? (
            <Image
              src={src}
              alt={alt}
              fill
              unoptimized
              loading="eager"
              decoding="async"
              sizes="100vw"
              className="object-contain"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
