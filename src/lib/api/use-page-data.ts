"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ApiError } from "./errors";
import { revalidateVersion, subscribeRevalidate } from "./revalidate";

export interface PageData<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

export interface PageDataOptions {
  /**
   * SN-10: re-load the page this often while it is mounted (the Finance page polls every 30 s so released funds
   * and ledger movements appear without a refresh). Omitted or 0 means no polling, which is what every other
   * caller keeps: a page still reloads after a write through the revalidate subscription.
   */
  refreshMs?: number;
}

export const LOGIN_PATH = "/auth/v1/login";

/**
 * Loads a page's data in the browser (replaces the async Server Component load). Reloads when an action
 * calls revalidatePath(), or when `key` changes. A signed-out session goes to the login page, as the server
 * layouts did; any other failure is returned in `error` for the page to rethrow to the error boundary.
 */
export function usePageData<T>(key: string, loader: () => Promise<T>, options: PageDataOptions = {}): PageData<T> {
  const version = useSyncExternalStore(subscribeRevalidate, revalidateVersion, () => 0);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown; loading: boolean }>({
    key,
    loading: true,
  });
  // One load at a time: a poll that fires while the previous load is still running is skipped, not queued.
  const inFlight = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `loader` is recreated each render; key, version and nonce say when to load.
  useEffect(() => {
    let live = true;
    inFlight.current = true;
    // Keep showing the previous data during a revalidation; only a new key starts from the skeleton.
    setState((prev) => (prev.key === key ? { ...prev, loading: prev.data === undefined } : { key, loading: true }));
    loader().then(
      (data) => {
        inFlight.current = false;
        if (live) setState({ key, data, loading: false });
      },
      (error: unknown) => {
        inFlight.current = false;
        if (!live) return;
        if (error instanceof ApiError && error.isAuthFailure) {
          window.location.assign(LOGIN_PATH);
          return;
        }
        setState({ key, error, loading: false });
      },
    );
    return () => {
      live = false;
    };
  }, [key, version, nonce]);

  const refreshMs = options.refreshMs ?? 0;
  useEffect(() => {
    if (!(refreshMs > 0)) return;
    const timer = setInterval(() => {
      // A hidden tab changes nothing the user can see; the visible tab catches up on its next tick.
      if (document.hidden || inFlight.current) return;
      setNonce((n) => n + 1);
    }, refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current || state.loading,
    reload,
  };
}
