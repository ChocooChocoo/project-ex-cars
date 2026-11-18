"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => undefined;

/**
 * The page's query string, read in the browser (a static page is built without one). Null during the
 * build-time render and the first hydration pass, so a page can wait instead of flashing the wrong state.
 */
export function useQuery(): URLSearchParams | null {
  const search = useSyncExternalStore(
    noop,
    () => window.location.search,
    () => null,
  );
  return search === null ? null : new URLSearchParams(search);
}
