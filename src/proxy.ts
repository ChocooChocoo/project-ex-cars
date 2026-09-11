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

  const refreshedCookies = await refreshSession(request);
  const withSession = (response: NextResponse) => {
    for (const { name, value, options } of refreshedCookies) {
      response.cookies.set(name, value, options as never);
    }
    return response;
  };

  const role = request.cookies.get("gce-role")?.value ?? null;
  const url = request.nextUrl.clone();

  // Root → redirect based on role
  if (pathname === "/") {
    url.pathname = role ? landingPath(role) : "/auth/v1/login";
    return withSession(NextResponse.redirect(url));
  }

  // No role → redirect to login for all non-auth pages
  if (!role) {
    url.pathname = "/auth/v1/login";
    return withSession(NextResponse.redirect(url));
  }

  // Role-prefixed path: /[role]/rest → strip prefix, rewrite internally
  const firstSegment = pathname.split("/")[1];
  if (firstSegment && ROLE_SET.has(firstSegment)) {
    if (firstSegment !== role) {
      const rest = pathname.slice(firstSegment.length + 1) || "";
      url.pathname = `/${role}${rest}`;
      return withSession(NextResponse.redirect(url));
    }

    const segment = pathname.slice(firstSegment.length + 2) || "dashboard";
    const internal = resolveInternalPath(firstSegment, segment);
    url.pathname = internal;
    return withSession(NextResponse.rewrite(url));
  }

  // Legacy paths → redirect to role-prefixed
  if (pathname.startsWith("/dashboard")) {
    const segment = pathname.replace("/dashboard/", "").replace("/dashboard", "dashboard");
    url.pathname = isStaffRole(role)
      ? `/${role}/${segment === "default" ? "dashboard" : segment}`
      : `/${role}/showroom`;
    return withSession(NextResponse.redirect(url));
  }

  return withSession(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
