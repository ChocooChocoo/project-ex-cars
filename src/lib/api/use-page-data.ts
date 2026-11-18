"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { ApiError } from "./errors";
import { revalidateVersion, subscribeRevalidate } from "./revalidate";

export interface PageData<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

export const LOGIN_PATH = "/auth/v1/login";

/**
 * Loads a page's data in the browser (replaces the async Server Component load). Reloads when an action
 * calls revalidatePath(), or when `key` changes. A signed-out session goes to the login page, as the server
 * layouts did; any other failure is returned in `error` for the page to rethrow to the error boundary.
 */
export function usePageData<T>(key: string, loader: () => Promise<T>): PageData<T> {
  const version = useSyncExternalStore(subscribeRevalidate, revalidateVersion, () => 0);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown; loading: boolean }>({
    key,
    loading: true,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `loader` is recreated each render; key, version and nonce say when to load.
  useEffect(() => {
    let live = true;
    // Keep showing the previous data during a revalidation; only a new key starts from the skeleton.
    setState((prev) => (prev.key === key ? { ...prev, loading: prev.data === undefined } : { key, loading: true }));
    loader().then(
      (data) => {
        if (live) setState({ key, data, loading: false });
      },
      (error: unknown) => {
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

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current || state.loading,
    reload,
  };
}
