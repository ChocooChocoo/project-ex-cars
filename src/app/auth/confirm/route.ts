import { type NextRequest, NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { apiGet, relaySetCookies } from "@/lib/api/server";
import type { Me } from "@/lib/api/types";
import { landingPath } from "@/lib/routing/paths";

const safeNext = (value: string | null) => (value?.startsWith("/") && !value.startsWith("//") ? value : null);

// Only Laravel's signed email-verification and email-change paths may be relayed.
const SIGNED_PATH =
  /^\/api\/v1\/auth\/email\/(verify\/[\w-]+\/[0-9a-f]{40}|change\/[\w-]+)\?[^#\s]*signature=[0-9a-f]+/;

// Emailed links (verification, email change) land here, often in another browser (Gmail). Laravel checks
// the signature, verifies the address and signs the user in; this handler relays that session cookie
// and sets the routing hint before redirecting.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const signedPath = searchParams.get("verify");
  const nextPath = safeNext(searchParams.get("next"));

  if (!signedPath || !SIGNED_PATH.test(signedPath)) {
    return NextResponse.redirect(`${origin}/auth/v1/login?error=confirmation_failed`);
  }

  try {
    const result = await apiGet<Me>(signedPath);
    await relaySetCookies(result.setCookies);
    const role = result.data.role ?? "customer";
    const response = NextResponse.redirect(`${origin}${nextPath ?? landingPath(role)}`);
    response.cookies.set("gce-role", role, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    const reason = error instanceof ApiError && error.status === 409 ? "email_taken" : "confirmation_failed";
    return NextResponse.redirect(`${origin}/auth/v1/login?error=${reason}`);
  }
}
