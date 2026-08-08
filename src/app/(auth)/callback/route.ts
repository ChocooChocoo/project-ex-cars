import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
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
      let landing = "/dashboard/default";

      if (user) {
        const admin = createAdminClient();
        const { data: roles } = await admin.rpc("get_user_roles");
        const roleRecord = (roles as { account_id: string; role: string }[] | null)?.find(
          (r) => r.account_id === user.id,
        );
        const role = roleRecord?.role ?? "customer";

        if (role === "customer" || role === "supplier") {
          landing = "/showroom";
        } else if (role === "mechanic") {
          landing = "/dashboard/inspections";
        } else if (role === "marketing_specialist") {
          landing = "/dashboard/vehicles";
        }

        const response = NextResponse.redirect(`${origin}${landing}`);
        response.cookies.set("gce-role", role, {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
        return response;
      }

      return NextResponse.redirect(`${origin}${landing}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/v1/login?error=auth_callback_failed`);
}
