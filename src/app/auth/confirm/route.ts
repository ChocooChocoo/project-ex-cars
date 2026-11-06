import { type NextRequest, NextResponse } from "next/server";

import { landingPath } from "@/lib/routing/paths";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];

const safeNext = (value: string | null) => (value?.startsWith("/") && !value.startsWith("//") ? value : null);

// Gmail opens confirmation links in its own browser. The PKCE code-verifier cookie from signUp is not
// there, so the token hash is verified on the server and the role cookie is set on this response.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "signup") as OtpType;
  const nextPath = safeNext(searchParams.get("next"));
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");

  if (errorCode) {
    return NextResponse.redirect(`${origin}/auth/v1/login?error=${encodeURIComponent(errorCode)}`);
  }
  if (!tokenHash || !OTP_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/auth/v1/login?error=confirmation_failed`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(`${origin}/auth/v1/login?error=confirmation_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/auth/v1/login?error=confirmation_failed`);

  const { data: roles } = await supabase.rpc("get_user_roles");
  const roleRecord = (roles as { account_id: string; role: string }[] | null)?.find(
    (row) => row.account_id === user.id,
  );
  const role = roleRecord?.role ?? "customer";
  const response = NextResponse.redirect(`${origin}${nextPath ?? landingPath(role)}`);
  response.cookies.set("gce-role", role, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
