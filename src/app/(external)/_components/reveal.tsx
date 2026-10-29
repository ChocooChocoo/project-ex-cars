"use client";

import { motion, useReducedMotion } from "motion/react";

// Content rises into place once as it scrolls into view. Reduced motion shows it at once; the start
// state is the same on server and client so hydration never mismatches.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  readonly children: React.ReactNode;
  readonly delay?: number;
  readonly className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reduce ? { duration: 0 } : { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
