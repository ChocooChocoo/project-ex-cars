import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { GCE_ROLES } from "@/lib/auth/roles";
import { isStaffRole, landingPath, resolveInternalPath } from "@/lib/routing/paths";

const ROLE_SET = new Set<string>(GCE_ROLES);

type ResponseCookie = { name: string; value: string; options?: Record<string, unknown> };

// Supabase rotates refresh tokens on every refresh (auth.enable_refresh_token_rotation
// in supabase/config.toml). A Server Component render cannot write cookies, so if the
// refresh only happened there the rotated token would be dropped and the next request
// would present a spent token — the SDK turns that into a random logout. The proxy runs
// before the render and is allowed to write cookies, so it owns the refresh.
function createSessionClient(request: NextRequest, onCookies: (cookies: ResponseCookie[]) => void) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        onCookies(cookiesToSet);
      },
    },
  });
}

// Refreshes an expiring session and returns the cookies that must ride the response.
// A Supabase outage must not take the whole app down, so failure falls through to a
// normal (unauthenticated) render, which redirects to login on its own.
async function refreshSession(request: NextRequest): Promise<ResponseCookie[]> {
  const refreshed: ResponseCookie[] = [];
  try {
    const supabase = createSessionClient(request, (cookies) => refreshed.push(...cookies));
    if (!supabase) return [];
    // getUser() validates against the auth server and refreshes when the access token
    // is missing, expired, or within the SDK's 90s expiry margin.
    await supabase.auth.getUser();
  } catch {
    return [];
  }
  return refreshed;
}

// The refreshed cookies must ride every response, otherwise the browser keeps the spent
// token and the session drops on the next request.
function withSession<T extends NextResponse>(response: T, refreshed: ResponseCookie[]): T {
  for (const { name, value, options } of refreshed) {
    response.cookies.set(name, value, options as never);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip auth pages, template previews, API routes, and static files. These either
  // manage their own cookies (the /auth callback route handler) or need none.
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/template") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  if (/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)) {
    return NextResponse.next();
  }

  const refreshed = await refreshSession(request);

  // Rotated cookies otherwise exist only on the response, while the render for this same
  // request reads the request's own Cookie header — so it would render the pre-refresh
  // session even though the old refresh token is already spent server-side, which the SDK
  // can turn into a spurious logout. Putting them on the request fixes that, and the
  // render branches below forward the resulting headers to the downstream render.
  for (const { name, value } of refreshed) {
    request.cookies.set(name, value);
  }

  const role = request.cookies.get("gce-role")?.value ?? null;
  const url = request.nextUrl.clone();

  // Root → redirect based on role
  if (pathname === "/") {
    url.pathname = role ? landingPath(role) : "/auth/v1/login";
    return withSession(NextResponse.redirect(url), refreshed);
  }

  // No role → redirect to login for all non-auth pages
  if (!role) {
    url.pathname = "/auth/v1/login";
    return withSession(NextResponse.redirect(url), refreshed);
  }

  // Role-prefixed path: /[role]/rest → strip prefix, rewrite internally
  const firstSegment = pathname.split("/")[1];
  if (firstSegment && ROLE_SET.has(firstSegment)) {
    if (firstSegment !== role) {
      const rest = pathname.slice(firstSegment.length + 1) || "";
      url.pathname = `/${role}${rest}`;
      return withSession(NextResponse.redirect(url), refreshed);
    }

    const segment = pathname.slice(firstSegment.length + 2) || "dashboard";
    const internal = resolveInternalPath(firstSegment, segment);
    url.pathname = internal;
    return withSession(NextResponse.rewrite(url, { request: { headers: request.headers } }), refreshed);
  }

  // Legacy paths → redirect to role-prefixed
  if (pathname.startsWith("/dashboard")) {
    const segment = pathname.replace("/dashboard/", "").replace("/dashboard", "dashboard");
    url.pathname = isStaffRole(role)
      ? `/${role}/${segment === "default" ? "dashboard" : segment}`
      : `/${role}/showroom`;
    return withSession(NextResponse.redirect(url), refreshed);
  }

  return withSession(NextResponse.next({ request: { headers: request.headers } }), refreshed);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
