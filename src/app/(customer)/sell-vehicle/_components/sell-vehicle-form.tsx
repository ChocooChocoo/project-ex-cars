"use client";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

import { submitSellVehicle } from "@/app/(customer)/my-transactions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type SellVehicleFormData, sellVehicleSchema } from "@/lib/validation/transactions";

export function SellVehicleForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SellVehicleFormData>({
    resolver: zodResolver(sellVehicleSchema) as unknown as Resolver<SellVehicleFormData>,
  });

  async function onSubmit(data: SellVehicleFormData) {
    const fd = new FormData();
    fd.set("make", data.make);
    fd.set("model", data.model);
    fd.set("year", String(data.year));
    fd.set("mileage", String(data.mileage));
    fd.set("condition", data.condition);
    fd.set("offered_amount", String(data.offered_amount));
    if (data.description) fd.set("description", data.description);

    const result = await submitSellVehicle(fd);
    if (result.error) {
      toast.error(result.error);
    } else if (result.id) {
      toast.success("Vehicle submitted for evaluation!");
      router.push(`/my-transactions/${result.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.make}>
              <FieldLabel>Make *</FieldLabel>
              <Input {...register("make")} placeholder="e.g. Honda" />
              {errors.make && <FieldError errors={[{ message: errors.make.message }]} />}
            </Field>
            <Field data-invalid={!!errors.model}>
              <FieldLabel>Model *</FieldLabel>
              <Input {...register("model")} placeholder="e.g. Civic" />
              {errors.model && <FieldError errors={[{ message: errors.model.message }]} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.year}>
              <FieldLabel>Year *</FieldLabel>
              <Input {...register("year")} type="number" placeholder="2020" />
              {errors.year && <FieldError errors={[{ message: errors.year.message }]} />}
            </Field>
            <Field data-invalid={!!errors.mileage}>
              <FieldLabel>Mileage (km) *</FieldLabel>
              <Input {...register("mileage")} type="number" placeholder="50000" />
              {errors.mileage && <FieldError errors={[{ message: errors.mileage.message }]} />}
            </Field>
          </div>
          <Field data-invalid={!!errors.condition}>
            <FieldLabel>Condition *</FieldLabel>
            <Input {...register("condition")} placeholder="e.g. Good, Fair, Excellent" />
            {errors.condition && <FieldError errors={[{ message: errors.condition.message }]} />}
          </Field>
          <Field data-invalid={!!errors.offered_amount}>
            <FieldLabel>Offered Amount (₱) *</FieldLabel>
            <Input {...register("offered_amount")} type="number" min="0" placeholder="Your asking price" />
            {errors.offered_amount && <FieldError errors={[{ message: errors.offered_amount.message }]} />}
          </Field>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea {...register("description")} placeholder="Any additional details about the vehicle..." rows={3} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Vehicle"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
