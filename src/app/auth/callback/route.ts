import { type NextRequest, NextResponse } from "next/server";

// Supabase PKCE callback, retired with Supabase Auth. Emailed links now go to /auth/confirm; anything
// still pointing here (an old email) gets a clear "link expired" sign-in prompt.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  if (searchParams.get("verify")) {
    return NextResponse.redirect(`${origin}/auth/confirm?${searchParams.toString()}`);
  }
  return NextResponse.redirect(`${origin}/auth/v1/login?error=link_expired`);
}
