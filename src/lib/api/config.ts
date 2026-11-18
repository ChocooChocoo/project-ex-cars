/** Laravel API origin, e.g. http://localhost:8000 locally and https://api.<domain> in production. */
export function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

/** Laravel session cookie name (backend SESSION_COOKIE). */
export const SESSION_COOKIE = "gce_session";
export const XSRF_COOKIE = "XSRF-TOKEN";
/** Laravel's remember-me cookie is `remember_web_<hash>`. */
export const REMEMBER_COOKIE_PREFIX = "remember_web_";

/** Only these cookies are ever forwarded to Laravel; everything else (preferences, gce-role) stays in Next.js. */
export function isForwardedCookie(name: string): boolean {
  return name === SESSION_COOKIE || name === XSRF_COOKIE || name.startsWith(REMEMBER_COOKIE_PREFIX);
}

/** Public file on Laravel's `public` disk (showroom media, avatars), served at {API}/storage/{bucket}/{path}. */
export function publicStorageUrl(bucket: "showroom-media" | "avatars", path: string): string {
  return `${apiBaseUrl()}/storage/${bucket}/${path.replace(/^\/+/, "")}`;
}
