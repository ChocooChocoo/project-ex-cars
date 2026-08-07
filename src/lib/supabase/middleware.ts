import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

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

  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isRoot = request.nextUrl.pathname === "/";

  if (!user && (isDashboard || isRoot)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/v1/login";
    return NextResponse.redirect(url);
  }

  if (user && (isAuthPage || isRoot)) {
    const role = request.cookies.get("gce-role")?.value;
    const url = request.nextUrl.clone();

    if (role === "customer" || role === "supplier") {
      url.pathname = "/showroom";
    } else if (role === "mechanic") {
      url.pathname = "/dashboard/inspections";
    } else if (role === "marketing_specialist") {
      url.pathname = "/dashboard/vehicles";
    } else {
      url.pathname = "/dashboard/default";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
