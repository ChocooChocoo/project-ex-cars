"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { resendVerificationEmail, signIn } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { emailSchema } from "@/lib/validation/forms";

const formSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  remember: z.boolean().optional(),
});

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  // Set when Laravel refuses the login because the email is not verified yet.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const onResend = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    const result = await resendVerificationEmail(unverifiedEmail);
    setResending(false);
    if ("error" in result) toast.error(result.error);
    else toast.success(result.notice);
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setLoading(true);

    const formData = new FormData();
    formData.set("email", data.email);
    formData.set("password", data.password);
    if (data.remember) formData.set("remember", "on");

    const result = await signIn(formData);

    if (result?.error) {
      const unverified = "code" in result && result.code === "email_not_verified";
      setUnverifiedEmail(unverified ? data.email : null);
      if (!unverified) toast.error(result.error);
      setLoading(false);
    }
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">Email Address</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <PasswordInput
                {...field}
                id="login-password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="remember"
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <Checkbox
                id="login-remember"
                name={field.name}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                aria-invalid={fieldState.invalid}
              />
              <FieldContent>
                <FieldLabel htmlFor="login-remember" className="font-normal">
                  Remember me for 30 days
                </FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
            </Field>
          )}
        />
      </FieldGroup>
      {unverifiedEmail && (
        <div role="alert" className="rounded-lg border px-3 py-2.5 text-sm">
          <p>Verify your email before you log in. Open the link we sent to {unverifiedEmail}.</p>
          <Button type="button" variant="link" className="h-auto p-0 text-sm" disabled={resending} onClick={onResend}>
            {resending ? "Sending..." : "Resend verification email"}
          </Button>
        </div>
      )}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Login"}
      </Button>
    </form>
  );
}
