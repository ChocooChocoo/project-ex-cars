import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { GCE_ROLES } from "@/lib/auth/roles";
import { isStaffRole, landingPath, resolveInternalPath } from "@/lib/routing/paths";

const PROTECTED_PATHS = ["/showroom", "/inquiries", "/recommendations"];
const ROLE_SET = new Set<string>(GCE_ROLES);

function getCookieRole(request: NextRequest): string | null {
  return request.cookies.get("gce-role")?.value ?? null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/auth");
  const isApiRoute = pathname.startsWith("/api") || pathname.startsWith("/_next");
  const isStatic = /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname);

  if (isApiRoute || isStatic) {
    return supabaseResponse;
  }

  // ---- UNAUTHENTICATED ----
  if (!user) {
    if (isAuthPage) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/auth/v1/login";
    return NextResponse.redirect(url);
  }

  // ---- AUTHENTICATED ----
  const role = getCookieRole(request);
  const url = request.nextUrl.clone();

  // Auth pages → redirect to role landing
  if (isAuthPage) {
    url.pathname = role ? landingPath(role) : "/auth/v1/login";
    return NextResponse.redirect(url);
  }

  // Root → redirect to role landing
  if (pathname === "/") {
    url.pathname = role ? landingPath(role) : "/auth/v1/login";
    return NextResponse.redirect(url);
  }

  // ---- Role-prefixed path: /[role]/rest ----
  const firstSegment = pathname.split("/")[1];
  if (firstSegment && ROLE_SET.has(firstSegment)) {
    // Wrong role in URL → redirect to correct role
    if (role && firstSegment !== role) {
      const rest = pathname.slice(firstSegment.length + 1) || "";
      url.pathname = `/${role}${rest}`;
      return NextResponse.redirect(url);
    }

    // Correct role → strip prefix, rewrite internally
    const segment = pathname.slice(firstSegment.length + 2) || "dashboard";
    const internal = resolveInternalPath(firstSegment, segment);
    url.pathname = internal;
    return NextResponse.rewrite(url);
  }

  // ---- Legacy paths → redirect to role-prefixed ----
  if (role) {
    if (pathname.startsWith("/dashboard")) {
      const segment = pathname.replace("/dashboard/", "").replace("/dashboard", "dashboard");
      url.pathname = isStaffRole(role)
        ? `/${role}/${segment === "default" ? "dashboard" : segment}`
        : `/${role}/showroom`;
      return NextResponse.redirect(url);
    }

    if (PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      const seg = pathname.slice(1);
      url.pathname = `/${role}/${seg}`;
      if (!url.pathname.endsWith("/")) url.pathname += "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
