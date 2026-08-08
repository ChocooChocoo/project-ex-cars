"use client";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { submitRequestCar } from "@/app/(customer)/my-transactions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileAutoFill } from "@/lib/autofill";
import { type RequestCarFormData, requestCarSchema } from "@/lib/validation/transactions";

export function RequestCarForm({ autofill }: { readonly autofill: ProfileAutoFill | null }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RequestCarFormData>({
    resolver: zodResolver(requestCarSchema),
    defaultValues: {
      requested_make: "",
      requested_model: "",
      budget: undefined,
      other_preferences: "",
    },
  });

  async function onSubmit(data: RequestCarFormData) {
    const fd = new FormData();
    fd.set("requested_make", data.requested_make);
    fd.set("requested_model", data.requested_model);
    if (data.year_min) fd.set("year_min", String(data.year_min));
    if (data.year_max) fd.set("year_max", String(data.year_max));
    fd.set("budget", String(data.budget));
    if (data.other_preferences) fd.set("other_preferences", data.other_preferences);

    const result = await submitRequestCar(fd);
    if (result.error) {
      toast.error(result.error);
    } else if (result.id) {
      toast.success("Request submitted!");
      router.push(`/my-transactions/${result.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.requested_make}>
              <FieldLabel>Make *</FieldLabel>
              <Input {...register("requested_make")} placeholder="e.g. Toyota" />
              {errors.requested_make && <FieldError errors={[errors.requested_make.message ?? ""]} />}
            </Field>
            <Field data-invalid={!!errors.requested_model}>
              <FieldLabel>Model *</FieldLabel>
              <Input {...register("requested_model")} placeholder="e.g. Hilux" />
              {errors.requested_model && <FieldError errors={[errors.requested_model.message ?? ""]} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Min Year</FieldLabel>
              <Controller
                control={control}
                name="year_min"
                render={({ field }) => (
                  <Input
                    type="number"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Any"
                  />
                )}
              />
            </Field>
            <Field>
              <FieldLabel>Max Year</FieldLabel>
              <Controller
                control={control}
                name="year_max"
                render={({ field }) => (
                  <Input
                    type="number"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Any"
                  />
                )}
              />
            </Field>
          </div>
          <Field data-invalid={!!errors.budget}>
            <FieldLabel>Budget (₱) *</FieldLabel>
            <Controller
              control={control}
              name="budget"
              render={({ field }) => (
                <Input
                  type="number"
                  min="0"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Your maximum budget"
                />
              )}
            />
            {errors.budget && <FieldError errors={[errors.budget.message ?? ""]} />}
          </Field>
          <Field>
            <FieldLabel>Other Preferences</FieldLabel>
            <Textarea
              {...register("other_preferences")}
              placeholder="Color, transmission, fuel type, or any other requirements..."
              rows={3}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
