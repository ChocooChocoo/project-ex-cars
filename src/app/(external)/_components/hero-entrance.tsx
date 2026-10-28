"use client";

import { motion, useReducedMotion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

// The page's one authored moment: the hero copy settles in line by line while the photo unmasks
// from the road up, like a car rolling into the frame. The server and client render the same start
// state; reduced motion only drops the durations to zero, so hydration never mismatches.
export function HeroCopy({ children }: { readonly children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex flex-col gap-6"
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduce ? 0 : 0.09 } } }}
    >
      {children}
    </motion.div>
  );
}

export function HeroLine({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
        shown: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: reduce ? { duration: 0 } : { duration: 0.7, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function HeroPhoto({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
      animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
      transition={reduce ? { duration: 0 } : { duration: 1.1, delay: 0.15, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
