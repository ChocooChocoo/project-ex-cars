import { type NextRequest, NextResponse } from "next/server";

import { landingPath } from "@/lib/routing/paths";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
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
        const landing = landingPath(role);

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

  return NextResponse.redirect(`${origin}/auth/v1/login?error=auth_callback_failed`);
}
