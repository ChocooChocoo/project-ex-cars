"use client";

import { usePathname } from "next/navigation";

/**
 * The URL segment that follows `after`, e.g. useRouteParam("vehicles") on /ceo/vehicles/<id>/ → "<id>".
 * Static export builds each [id] page once under a placeholder, so useParams() returns "_"; the real id
 * is only in the browser's URL (role-prefixed or not).
 */
export function useRouteParam(after: string): string {
  return routeParam(usePathname(), after);
}

export function routeParam(pathname: string, after: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const at = segments.lastIndexOf(after);
  return at >= 0 && at + 1 < segments.length ? decodeURIComponent(segments[at + 1]) : "";
}
