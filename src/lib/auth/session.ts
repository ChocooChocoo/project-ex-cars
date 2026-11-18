import { cache } from "react";

import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { Me } from "@/lib/api/types";

/**
 * The signed-in account, read from Laravel `GET /api/v1/me` with the request's own session cookie.
 *
 * `cache` memoises per request only (React server cache), so a layout, page and action in the same
 * render share one call while two users never share a result. Returns null when signed out or the
 * account is inactive; an outage throws, so it is not mistaken for "signed out".
 */
export const getSession = cache(async (): Promise<Me | null> => {
  try {
    return (await apiGet<Me>("/api/v1/me")).data;
  } catch (error) {
    if (error instanceof ApiError && (error.isAuthFailure || error.status === 403)) return null;
    throw error;
  }
});
