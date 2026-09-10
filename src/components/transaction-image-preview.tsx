"use client";

import { useState } from "react";

import Image from "next/image";

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
    <div className="relative h-48 w-full overflow-hidden rounded-md">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes="(max-width: 768px) 100vw, 28rem"
        className={className ?? "object-contain"}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
