"use client";

import { useState } from "react";

import Image from "next/image";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Every submitted image opens in a larger view when clicked.
export function TransactionImagePreview({
  src,
  alt,
  className,
}: {
  readonly src: string;
  readonly alt: string;
  readonly className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <p className="text-muted-foreground text-xs">Preview unavailable</p>;
  }

  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Open ${alt} in a larger view`}
        className="relative block h-48 w-full cursor-zoom-in overflow-hidden rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 28rem"
          className={className ?? "object-contain"}
          onError={() => setFailed(true)}
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative h-[min(80vh,48rem)] w-full">
          <Image src={src} alt={alt} fill unoptimized sizes="100vw" className="object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
