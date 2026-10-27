"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { signUp } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { emailSchema, fullNameSchema, passwordSchema } from "@/lib/validation/forms";

const formSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, { message: "You must agree to the Terms and Conditions." }),
    acceptPolicy: z.boolean().refine((v) => v, { message: "You must agree to the Company Policy." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

const POLICY_FIELDS = [
  { name: "acceptTerms", id: "register-accept-terms", label: "I agree to the Terms and Conditions" },
  { name: "acceptPolicy", id: "register-accept-policy", label: "I agree to the Company Policy" },
] as const;

export function RegisterForm() {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
      acceptPolicy: false,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);

    const formData = new FormData();
    formData.set("email", data.email);
    formData.set("password", data.password);
    formData.set("full_name", data.fullName);
    formData.set("accept_terms", String(data.acceptTerms));
    formData.set("accept_policy", String(data.acceptPolicy));

    const result = await signUp(formData);

    if (result?.notice) {
      setNotice(result.notice);
    } else if (result?.error) {
      toast.error(result.error);
    }
    setLoading(false);
  };

  if (notice) {
    return (
      <Alert role="status">
        <AlertTitle>{notice}</AlertTitle>
        <AlertDescription>
          We sent a verification link to {form.getValues("email")}. Open it to finish creating your account.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="fullName"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-fullname">Full Name</FieldLabel>
              <Input
                {...field}
                id="register-fullname"
                type="text"
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-email">Email Address</FieldLabel>
              <Input
                {...field}
                id="register-email"
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
              <FieldLabel htmlFor="register-password">Password</FieldLabel>
              <PasswordInput
                {...field}
                id="register-password"
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
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-confirm-password">Confirm Password</FieldLabel>
              <PasswordInput
                {...field}
                id="register-confirm-password"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {POLICY_FIELDS.map((policy) => (
          <Controller
            key={policy.name}
            control={form.control}
            name={policy.name}
            render={({ field, fieldState }) => (
              <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                <Checkbox
                  id={policy.id}
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  aria-invalid={fieldState.invalid}
                />
                <FieldContent>
                  <FieldLabel htmlFor={policy.id} className="font-normal">
                    {policy.label}
                  </FieldLabel>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </FieldContent>
              </Field>
            )}
          />
        ))}
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Creating account..." : "Register"}
      </Button>
    </form>
  );
}
