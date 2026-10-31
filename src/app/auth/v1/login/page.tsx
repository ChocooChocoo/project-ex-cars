import Link from "next/link";

import { GceLogo } from "@/components/gce-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { LoginForm } from "../../_components/login-form";

export default async function LoginV1({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <div className="flex h-dvh">
      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <Link href="/" aria-label="GCE home" className="mx-auto block w-fit">
              <GceLogo className="mx-auto size-12 text-primary-foreground" letterColor="var(--primary)" />
            </Link>
            <div className="space-y-2">
              <h1 className="font-light text-5xl text-primary-foreground">Hello again</h1>
              <p className="text-primary-foreground/80 text-xl">Login to continue</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
            >
              ← Home
            </Link>
            <div className="font-medium tracking-tight">Login</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Welcome back. Enter your email and password, let&apos;s hope you remember them this time.
            </div>
          </div>
          <div className="space-y-4">
            {error === "auth_callback_failed" && (
              <Alert variant="destructive">
                <AlertDescription>Sign-in could not be completed. Please try again.</AlertDescription>
              </Alert>
            )}
            {notice === "email_confirmed" && (
              <Alert>
                <AlertDescription>Your new email is confirmed. Sign in with it to continue.</AlertDescription>
              </Alert>
            )}
            <LoginForm />
            <p className="text-center text-muted-foreground text-xs">
              Don&apos;t have an account?{" "}
              <Link prefetch={false} href="register" className="text-primary">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
