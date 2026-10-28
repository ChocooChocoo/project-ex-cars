import { type NextRequest, NextResponse } from "next/server";

import { landingPath } from "@/lib/routing/paths";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only same-site paths, so the link cannot send users to another site.
  const next = searchParams.get("next");
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : null;

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: roles } = await supabase.rpc("get_user_roles");
        const roleRecord = (roles as { account_id: string; role: string }[] | null)?.find(
          (r) => r.account_id === user.id,
        );
        const role = roleRecord?.role ?? "customer";
        const landing = nextPath ?? landingPath(role);

        const response = NextResponse.redirect(`${origin}${landing}`);
        response.cookies.set("gce-role", role, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
        return response;
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Only the email-change link carries `next`. Opened in another browser, Supabase has already
  // changed the email but this browser cannot finish the sign-in, so ask for a fresh sign-in.
  if (nextPath) return NextResponse.redirect(`${origin}/auth/v1/login?notice=email_confirmed`);
  return NextResponse.redirect(`${origin}/auth/v1/login?error=auth_callback_failed`);
}
