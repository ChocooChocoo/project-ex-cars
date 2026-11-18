// Server-only: `next/headers` makes any client import fail at build time.
import { cookies } from "next/headers";

import { apiBaseUrl, isForwardedCookie, XSRF_COOKIE } from "./config";
import { ApiError } from "./errors";

/**
 * Server-side Laravel client for Server Components, Server Actions and route handlers.
 *
 * - Talks only to the fixed Laravel origin; paths must be relative (`/api/v1/...`).
 * - Forwards only the Laravel session/XSRF/remember cookies, never arbitrary request headers.
 * - Sends the trusted frontend Origin/Referer so Sanctum treats the call as a first-party cookie session.
 * - Never cached across requests (`cache: "no-store"`); per-request memoisation lives in src/lib/auth/session.ts.
 */

/** The Next.js origin Laravel trusts (backend SANCTUM_STATEFUL_DOMAINS / FRONTEND_URL). */
function frontendOrigin(): string {
  return (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
}

export interface ApiResult<T> {
  status: number;
  data: T;
  /** Raw Set-Cookie headers; relay them with relaySetCookies() from an action or route handler only. */
  setCookies: string[];
}

// Values in the jar are always DECODED (raw base64 from Laravel). Next.js cookies() decodes on read and
// encodes on write, Set-Cookie headers carry encoded values, and the Cookie header we send must be
// encoded exactly once (PHP url-decodes it; a raw "+" would turn into a space).
type Jar = Map<string, string>;

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

async function currentJar(): Promise<Jar> {
  const store = await cookies();
  return new Map(
    store
      .getAll()
      .filter((c) => isForwardedCookie(c.name))
      .map((c) => [c.name, c.value]),
  );
}

function mergeSetCookies(jar: Jar, setCookies: string[]) {
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    if (isForwardedCookie(name)) jar.set(name, decode(pair.slice(eq + 1).trim()));
  }
}

async function send<T>(path: string, init: { method: string; body?: unknown }, jar: Jar): Promise<ApiResult<T>> {
  if (!path.startsWith("/")) throw new Error("apiFetch takes a relative path");
  const origin = frontendOrigin();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: origin,
    Referer: `${origin}/`,
    "X-Requested-With": "XMLHttpRequest",
  };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
  const xsrf = jar.get(XSRF_COOKIE);
  if (xsrf && init.method !== "GET") headers["X-XSRF-TOKEN"] = xsrf;
  // FormData (file uploads) sets its own multipart boundary.
  const multipart = init.body instanceof FormData;
  if (init.body !== undefined && !multipart) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : multipart ? (init.body as FormData) : JSON.stringify(init.body),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    throw new ApiError(0, { message: "Laravel API unreachable" });
  }

  const setCookies = response.headers.getSetCookie();
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(response.status, data ?? {});
  return { status: response.status, data: data as T, setCookies };
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  return send<T>(path, { method: "GET" }, await currentJar());
}

/**
 * State-changing call. Fetches a CSRF cookie first when the browser has none yet (first login,
 * registration), and returns every Set-Cookie Laravel issued along the way.
 */
export async function apiWrite<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const jar = await currentJar();
  const issued: string[] = [];
  if (!jar.has(XSRF_COOKIE)) {
    const csrf = await send<null>("/sanctum/csrf-cookie", { method: "GET" }, jar);
    mergeSetCookies(jar, csrf.setCookies);
    issued.push(...csrf.setCookies);
  }
  const result = await send<T>(path, { method, body }, jar);
  return { ...result, setCookies: [...issued, ...result.setCookies] };
}

/**
 * Copy Laravel's Set-Cookie headers onto the Next.js response (Server Action or route handler only;
 * a Server Component render cannot write cookies). Later headers win, so the post-login session id
 * replaces the pre-login one.
 */
export async function relaySetCookies(setCookies: string[]): Promise<void> {
  const store = await cookies();
  for (const header of setCookies) {
    const [pair, ...attrs] = header.split(";").map((s) => s.trim());
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    if (!isForwardedCookie(name)) continue;
    // Decode once: cookies().set() encodes again, so the browser ends up with Laravel's exact value.
    const value = decode(pair.slice(eq + 1));
    const opts: Parameters<typeof store.set>[2] = { path: "/" };
    for (const attr of attrs) {
      const [k, v = ""] = attr.split("=");
      switch (k.toLowerCase()) {
        case "domain":
          opts.domain = v;
          break;
        case "path":
          opts.path = v;
          break;
        case "expires":
          opts.expires = new Date(v);
          break;
        case "max-age":
          opts.maxAge = Number(v);
          break;
        case "httponly":
          opts.httpOnly = true;
          break;
        case "secure":
          opts.secure = true;
          break;
        case "samesite":
          opts.sameSite = v.toLowerCase() as "lax" | "strict" | "none";
          break;
      }
    }
    // Laravel clears a cookie with an expiry in the past; mirror that as a delete.
    if (opts.expires && new Date(opts.expires).getTime() < Date.now()) store.delete(name);
    else store.set(name, value, opts);
  }
}

/**
 * Public, cookie-less GET for pages that are statically regenerated (the landing page). Sends no session,
 * so it can use the Next.js data cache with `revalidate` instead of `no-store`.
 */
export async function apiPublicGet<T>(path: string, revalidate: number): Promise<T> {
  if (!path.startsWith("/")) throw new Error("apiPublicGet takes a relative path");
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { headers: { Accept: "application/json" }, next: { revalidate } });
  } catch {
    throw new ApiError(0, { message: "Laravel API unreachable" });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}
