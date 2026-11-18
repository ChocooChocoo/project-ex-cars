import { getClientCookie } from "../cookie.client";

/** Validated layout preference cookie (was the server getPreference()): the value if allowed, else the fallback. */
export function readPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = getClientCookie(key)?.trim();
  return allowed.includes(value as T) ? (value as T) : fallback;
}
