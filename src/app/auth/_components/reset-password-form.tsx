"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { resetPassword } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { newPasswordSchema } from "@/lib/validation/forms";

const formSchema = z
  .object({ password: newPasswordSchema, confirm_password: z.string() })
  .refine((data) => data.password === data.confirm_password, {
    message: "The new passwords do not match.",
    path: ["confirm_password"],
  });

export function ResetPasswordForm({ token, email }: Readonly<{ token: string; email: string }>) {
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirm_password: "" },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setLoading(true);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("email", email);
    formData.set("password", data.password);
    formData.set("confirm_password", data.confirm_password);
    // Success redirects to the login page; only a failure returns here.
    const result = await resetPassword(formData);
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    }
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="reset-password">New password</FieldLabel>
              <PasswordInput
                {...field}
                id="reset-password"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="confirm_password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="reset-confirm">Confirm new password</FieldLabel>
              <PasswordInput
                {...field}
                id="reset-confirm"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Set new password"}
      </Button>
    </form>
  );
}
