import { type NextRequest, NextResponse } from "next/server";

import { GCE_ROLES } from "@/lib/auth/roles";
import { isStaffRole, landingPath, resolveInternalPath } from "@/lib/routing/paths";

const ROLE_SET = new Set<string>(GCE_ROLES);

// Route presentation only. The `gce-role` cookie is a hint for the role prefix; it grants nothing.
// Laravel owns the session (no token refresh needed here: its session cookie does not rotate on
// reads) and re-authorises every request, and the layouts check the session via /api/v1/me.
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

  const role = request.cookies.get("gce-role")?.value ?? null;
  const url = request.nextUrl.clone();

  // Root: signed-in users go to their landing path; visitors see the public landing page.
  if (pathname === "/") {
    if (!role) return NextResponse.next({ request: { headers: request.headers } });
    url.pathname = landingPath(role);
    return NextResponse.redirect(url);
  }

  // No role → redirect to login for all non-auth pages
  if (!role) {
    url.pathname = "/auth/v1/login";
    return NextResponse.redirect(url);
  }

  // Role-prefixed path: /[role]/rest → strip prefix, rewrite internally
  const firstSegment = pathname.split("/")[1];
  if (firstSegment && ROLE_SET.has(firstSegment)) {
    if (firstSegment !== role) {
      const rest = pathname.slice(firstSegment.length + 1) || "";
      url.pathname = `/${role}${rest}`;
      return NextResponse.redirect(url);
    }

    const segment = pathname.slice(firstSegment.length + 2) || "dashboard";
    const internal = resolveInternalPath(firstSegment, segment);
    url.pathname = internal;
    return NextResponse.rewrite(url, { request: { headers: request.headers } });
  }

  // The user menus link to /profile for every role; send it to this role's profile page.
  if (pathname === "/profile") {
    url.pathname = `/${role}/profile`;
    return NextResponse.redirect(url);
  }

  // Legacy paths → redirect to role-prefixed
  if (pathname.startsWith("/dashboard")) {
    const segment = pathname.replace("/dashboard/", "").replace("/dashboard", "dashboard");
    url.pathname = isStaffRole(role)
      ? `/${role}/${segment === "default" ? "dashboard" : segment}`
      : `/${role}/showroom`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
