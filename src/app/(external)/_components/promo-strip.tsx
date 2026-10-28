"use client";

import { motion, useReducedMotion } from "motion/react";

// Marketing's published hero and promotions, run as one slow strip under the hero. The duplicate copy
// makes the loop seamless and is hidden from assistive tech. With reduced motion the strip stays still.
export function PromoStrip({ items }: { readonly items: { id: string; title: string; body: string | null }[] }) {
  const reduce = useReducedMotion();
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 px-8 py-4">
          <span className="font-semibold">{item.title}</span>
          {item.body ? <span className="text-primary-foreground/80 text-sm">{item.body}</span> : null}
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Promotions" className="overflow-hidden bg-primary text-primary-foreground">
      <motion.div
        className="flex w-max"
        animate={reduce ? { x: "0%" } : { x: ["0%", "-50%"] }}
        transition={reduce ? { duration: 0 } : { duration: 48, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
      >
        {row(false)}
        {row(true)}
      </motion.div>
    </section>
  );
}
