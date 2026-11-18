"use client";

import { useEffect, useRef } from "react";

export interface PollOptions {
  /** Delay between polls while the tab is visible. */
  intervalMs?: number;
  /** Delay while the tab is hidden; 0 pauses polling until the tab is shown again. */
  hiddenIntervalMs?: number;
  /** Set false to stop polling (for example while a thread is closed). */
  enabled?: boolean;
}

// ponytail: 4 s / 30 s are a starting guess; pick the final values after measuring request load on the
// Hostinger plan (phase-4.md). Laravel's `polling` rate limit allows 60 requests per minute per user.
export const POLL_INTERVAL_MS = 4_000;
export const POLL_HIDDEN_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Replaces the Supabase realtime channels: calls `poll(cursor)` on a timer and keeps the cursor it returns.
 * One request at a time (setTimeout chaining, no overlap), slower or paused while the tab is hidden, an
 * immediate poll when the tab becomes visible or the browser comes back online, and exponential backoff
 * after failures. Duplicates are the caller's to drop (the API overlaps windows a little on purpose).
 */
export function usePoll(
  initialCursor: string | null,
  poll: (cursor: string | null) => Promise<string | null>,
  { intervalMs = POLL_INTERVAL_MS, hiddenIntervalMs = POLL_HIDDEN_INTERVAL_MS, enabled = true }: PollOptions = {},
): void {
  const pollRef = useRef(poll);
  const cursorRef = useRef(initialCursor);
  useEffect(() => {
    pollRef.current = poll;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let stopped = false;
    let failures = 0;

    const delay = () => {
      const base = document.hidden ? hiddenIntervalMs : intervalMs;
      return failures ? Math.min(MAX_BACKOFF_MS, base * 2 ** failures) : base;
    };
    const schedule = () => {
      clearTimeout(timer);
      if (stopped || (document.hidden && hiddenIntervalMs === 0)) return;
      timer = setTimeout(tick, delay());
    };
    const tick = async () => {
      if (running || stopped) return;
      running = true;
      try {
        cursorRef.current = await pollRef.current(cursorRef.current);
        failures = 0;
      } catch {
        failures++;
      } finally {
        running = false;
        schedule();
      }
    };
    const wake = () => {
      if (!document.hidden) void tick();
      else schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [enabled, intervalMs, hiddenIntervalMs]);
}
