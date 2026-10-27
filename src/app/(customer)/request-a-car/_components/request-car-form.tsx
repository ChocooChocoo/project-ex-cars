"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { Controller, type Resolver, useController, useForm } from "react-hook-form";
import { toast } from "sonner";

import { submitRequestCar } from "@/app/(customer)/my-transactions/actions";
import { type BudgetCar, listCarsWithinBudget } from "@/app/(customer)/recommendations/actions";
import { BrandModelCombobox } from "@/components/brand-model-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { type RequestCarFormData, requestCarSchema } from "@/lib/validation/transactions";
import { VEHICLE_PURPOSES } from "@/lib/vehicles/catalog";

const BUDGET_LOOKUP_DELAY_MS = 600;

// C4: cars already in the showroom that fit the budget, so the buyer can stop here if one suits.
function BudgetMatches({ budget }: { readonly budget: number | undefined }) {
  const [result, setResult] = useState<{ budget: number; cars: BudgetCar[] } | null>(null);

  useEffect(() => {
    if (!budget || budget <= 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      listCarsWithinBudget(budget)
        .then((response) => {
          if (!cancelled) setResult({ budget, cars: "cars" in response ? response.cars : [] });
        })
        .catch(() => {
          if (!cancelled) setResult({ budget, cars: [] });
        });
    }, BUDGET_LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [budget]);

  if (!budget || budget <= 0 || !result || result.budget !== budget) return null;

  return (
    <section aria-labelledby="budget-matches-title" aria-live="polite" className="rounded-md border bg-muted/20 p-3">
      <h2 id="budget-matches-title" className="font-medium text-sm">
        Cars within your budget
      </h2>
      {result.cars.length === 0 ? (
        <p className="mt-1 text-muted-foreground text-sm">
          No car in the showroom fits {formatCurrency(budget, { noDecimals: true })} right now. Send the request and we
          will look for one.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y rounded-md border bg-background">
          {result.cars.map((car) => (
            <li key={car.id}>
              <Link
                href={`/showroom/${car.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <span className="min-w-0 truncate">{[car.year, car.make, car.model].filter(Boolean).join(" ")}</span>
                <span className="flex shrink-0 items-center gap-1 font-medium tabular-nums">
                  {formatCurrency(car.current_price, { noDecimals: true })}
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RequestCarForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RequestCarFormData>({
    resolver: zodResolver(requestCarSchema) as unknown as Resolver<RequestCarFormData>,
    defaultValues: {
      requested_make: "",
      requested_model: "",
      purpose: "",
      budget: undefined,
      other_preferences: "",
    },
  });
  // Stays true after a successful submit so a slow redirect cannot be beaten by a second click (duplicate request).
  const [sent, setSent] = useState(false);
  const budget = watch("budget");
  const { field: brand } = useController({ control, name: "requested_make" });
  const { field: model } = useController({ control, name: "requested_model" });

  async function onSubmit(data: RequestCarFormData) {
    const fd = new FormData();
    fd.set("requested_make", data.requested_make);
    fd.set("requested_model", data.requested_model);
    if (data.purpose) fd.set("purpose", data.purpose);
    if (data.year_min) fd.set("year_min", String(data.year_min));
    if (data.year_max) fd.set("year_max", String(data.year_max));
    fd.set("budget", String(data.budget));
    if (data.other_preferences) fd.set("other_preferences", data.other_preferences);

    const result = await submitRequestCar(fd);
    if (result.error) {
      toast.error(result.error);
    } else if (result.id) {
      setSent(true);
      toast.success("Request submitted!");
      // Full page load, not router.push: the budget lookup (a server action) can finish after the push and its
      // refresh of this page cancels the client navigation, leaving the buyer on the filled form.
      window.location.assign(`/my-transactions/${result.id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <BrandModelCombobox
            idPrefix="request"
            brand={brand.value}
            model={model.value}
            onBrandChange={brand.onChange}
            onModelChange={model.onChange}
            brandError={errors.requested_make?.message}
            modelError={errors.requested_model?.message}
          />
          <Field>
            <FieldLabel htmlFor="request-purpose">Purpose of the vehicle</FieldLabel>
            <Controller
              control={control}
              name="purpose"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="request-purpose" className="w-full">
                    <SelectValue placeholder="What will you use it for?" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_PURPOSES.map((purpose) => (
                      <SelectItem key={purpose} value={purpose}>
                        {purpose}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="request-year-min">Min Year</FieldLabel>
              <Controller
                control={control}
                name="year_min"
                render={({ field }) => (
                  <Input
                    id="request-year-min"
                    type="number"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Any"
                  />
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="request-year-max">Max Year</FieldLabel>
              <Controller
                control={control}
                name="year_max"
                render={({ field }) => (
                  <Input
                    id="request-year-max"
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
            <FieldLabel htmlFor="request-budget">Budget (₱) *</FieldLabel>
            <Controller
              control={control}
              name="budget"
              render={({ field }) => (
                <Input
                  id="request-budget"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Your maximum budget"
                />
              )}
            />
            <FieldDescription>We list showroom cars priced at or below this amount.</FieldDescription>
            {errors.budget && <FieldError errors={[{ message: errors.budget.message }]} />}
          </Field>
          <BudgetMatches budget={budget} />
          <Field>
            <FieldLabel htmlFor="request-preferences">Other Preferences</FieldLabel>
            <Textarea
              id="request-preferences"
              {...register("other_preferences")}
              placeholder="Color, transmission, fuel type, or any other requirements..."
              rows={3}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || sent}>
              {sent ? "Opening your request..." : isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
