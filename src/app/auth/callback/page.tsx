"use client";

import { useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";

// Supabase PKCE callback, retired with Supabase Auth. Emailed links now go to /auth/confirm; anything
// still pointing here (an old email) gets a clear "link expired" sign-in prompt.
export default function CallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    window.location.replace(
      params.get("verify") ? `/auth/confirm?${params.toString()}` : "/auth/v1/login?error=link_expired",
    );
  }, []);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}
