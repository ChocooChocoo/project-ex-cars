import Link from "next/link";

import { GceLogo } from "@/components/gce-logo";

import { ForgotPasswordForm } from "../../_components/forgot-password-form";

export default function ForgotPasswordV1() {
  return (
    <div className="flex h-dvh">
      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <Link href="/" aria-label="GCE home" className="mx-auto block w-fit">
              <GceLogo className="mx-auto size-12 text-primary-foreground" letterColor="var(--primary)" />
            </Link>
            <div className="space-y-2">
              <h1 className="font-light text-5xl text-primary-foreground">Forgot it?</h1>
              <p className="text-primary-foreground/80 text-xl">It happens</p>
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
            <div className="font-medium tracking-tight">Reset your password</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Enter the email you sign in with. We will send you a link to set a new password.
            </div>
          </div>
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
