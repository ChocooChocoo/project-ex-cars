"use client";

import { useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Me } from "@/lib/api/types";
import { setClientCookie } from "@/lib/cookie.client";
import { landingPath } from "@/lib/routing/paths";

const safeNext = (value: string | null) => (value?.startsWith("/") && !value.startsWith("//") ? value : null);

// Only Laravel's signed email-verification and email-change paths may be called.
const SIGNED_PATH =
  /^\/api\/v1\/auth\/email\/(verify\/[\w-]+\/[0-9a-f]{40}|change\/[\w-]+)\?[^#\s]*signature=[0-9a-f]+/;

// Emailed links (verification, email change) land here, often in another browser (Gmail). Laravel checks
// the signature, verifies the address and signs the user in (its response sets the session cookie); this
// page sets the routing hint and moves on. Was a route handler before the static build (Phase 4b).
export default function ConfirmPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const signedPath = params.get("verify");
    const nextPath = safeNext(params.get("next"));
    const fail = (reason: string) => window.location.replace(`/auth/v1/login?error=${reason}`);

    if (!signedPath || !SIGNED_PATH.test(signedPath)) {
      fail("confirmation_failed");
      return;
    }
    browserApi<Me>("GET", signedPath).then(
      (me) => {
        const role = me.role ?? "customer";
        setClientCookie("gce-role", role, 7);
        window.location.replace(nextPath ?? landingPath(role));
      },
      (error: unknown) =>
        fail(error instanceof ApiError && error.status === 409 ? "email_taken" : "confirmation_failed"),
    );
  }, []);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}
