"use client";

import Link from "next/link";

import { GceLogo } from "@/components/gce-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@/lib/routing/use-query";

import { ResetPasswordForm } from "../../_components/reset-password-form";

// Opened from the reset email: /auth/v1/reset-password?token=…&email=…
export default function ResetPasswordV1() {
  const query = useQuery();
  const token = query?.get("token");
  const email = query?.get("email");
  const linkOk = Boolean(token && email);

  return (
    <div className="flex h-dvh">
      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <Link href="/" aria-label="GCE home" className="mx-auto block w-fit">
              <GceLogo className="mx-auto size-12 text-primary-foreground" letterColor="var(--primary)" />
            </Link>
            <div className="space-y-2">
              <h1 className="font-light text-5xl text-primary-foreground">New password</h1>
              <p className="text-primary-foreground/80 text-xl">Then log in again</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <Link
              href="/auth/v1/login"
              className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
            >
              ← Back to login
            </Link>
            <div className="font-medium tracking-tight">Set a new password</div>
            {linkOk && <div className="mx-auto max-w-xl text-muted-foreground">For {email}</div>}
          </div>
          {query === null ? null : linkOk ? (
            <ResetPasswordForm token={token as string} email={email as string} />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                This reset link is incomplete. Open the link from your email again, or{" "}
                <Link href="/auth/v1/forgot-password" className="underline">
                  request a new one
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
