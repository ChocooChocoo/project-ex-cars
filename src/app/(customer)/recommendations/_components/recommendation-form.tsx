"use client";
"use no memo";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { PhilippinePeso, SlidersHorizontal, Sparkles } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { getWeightLabels } from "@/lib/recommendations/engine";
import { plainHintByLabel } from "@/lib/recommendations/plain-hints";
import { type RecommendationPreferences, recommendationPreferencesSchema } from "@/lib/validation/recommendations";
import { BODY_TYPES, BRANDS, SEAT_OPTIONS, VEHICLE_PURPOSES } from "@/lib/vehicles/catalog";

import { runRecommendation } from "../actions";

interface RecommendationFormProps {
  readonly onResults: (runId: string) => void;
}

type ChoiceName = "make" | "bodyType" | "seats" | "purpose" | "condition" | "fuel" | "transmission";

// T06: Make, Body Type, seats and purpose are required; the other details are optional.
const CHOICES: {
  name: ChoiceName;
  label: string;
  required: boolean;
  placeholder?: string;
  options: readonly { value: string; label: string }[];
}[] = [
  {
    name: "make",
    label: "Make",
    required: true,
    placeholder: "Select make",
    options: BRANDS.map((b) => ({ value: b, label: b })),
  },
  {
    name: "bodyType",
    label: "Body type",
    required: true,
    placeholder: "Select body type",
    options: BODY_TYPES.map((b) => ({ value: b, label: b })),
  },
  {
    name: "seats",
    label: "Number of seats",
    required: true,
    placeholder: "Select seats",
    options: SEAT_OPTIONS.map((s) => ({ value: s, label: `${s} seats` })),
  },
  {
    name: "purpose",
    label: "Purpose of the car",
    required: true,
    placeholder: "Select purpose",
    options: VEHICLE_PURPOSES.map((p) => ({ value: p, label: p })),
  },
  {
    name: "condition",
    label: "Condition",
    required: false,
    options: [
      { value: "any", label: "Any condition" },
      { value: "new", label: "New" },
      { value: "certified", label: "Certified" },
      { value: "used", label: "Used" },
    ],
  },
  {
    name: "fuel",
    label: "Fuel",
    required: false,
    options: [
      { value: "any", label: "Any fuel type" },
      { value: "electric", label: "Electric" },
      { value: "hybrid", label: "Hybrid" },
      { value: "diesel", label: "Diesel" },
      { value: "petrol", label: "Petrol" },
    ],
  },
  {
    name: "transmission",
    label: "Transmission",
    required: false,
    options: [
      { value: "any", label: "Any transmission" },
      { value: "automatic", label: "Automatic" },
      { value: "manual", label: "Manual" },
    ],
  },
];

function Label({ htmlFor, required, children }: { htmlFor: string; required: boolean; children: ReactNode }) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      {children}
      <span className="font-normal text-muted-foreground">{required ? " (required)" : " (optional)"}</span>
    </FieldLabel>
  );
}

export function RecommendationForm({ onResults }: RecommendationFormProps) {
  const [running, setRunning] = useState(false);

  const form = useForm<RecommendationPreferences>({
    // biome-ignore lint/suspicious/noExplicitAny: zod coerce fields cause resolver type mismatch
    resolver: zodResolver(recommendationPreferencesSchema) as any,
    defaultValues: {
      budget: 500000,
      condition: "any",
      fuel: "any",
      transmission: "any",
      make: "",
      bodyType: "" as never,
      seats: "" as never,
      purpose: "" as never,
      minYear: "",
      maxMileage: "",
      notes: "",
    },
  });

  const budget = form.watch("budget");

  async function onSubmit({ budget: amount, ...data }: RecommendationPreferences) {
    setRunning(true);
    try {
      // Saved with the run; "any" and blank optional fields are left out.
      const prefs: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== "" && value !== "any") prefs[key] = String(value);
      }

      const result = await runRecommendation(amount, prefs);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.runId) {
        toast.success("Recommendations ready!");
        onResults(result.runId);
      }
    } finally {
      setRunning(false);
    }
  }

  const weights = getWeightLabels();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5" />
          Find Your Perfect Car
        </CardTitle>
        <CardDescription>
          Tell us your budget and what you need. We rank available vehicles using five weighted criteria.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <div className="space-y-2">
            <FieldLabel className="flex items-center gap-1.5">
              <PhilippinePeso className="size-4" />
              Your Budget
            </FieldLabel>
            <Controller
              control={form.control}
              name="budget"
              render={({ field, fieldState }) => (
                <div className="space-y-3">
                  <Slider
                    min={50000}
                    max={5000000}
                    step={50000}
                    value={[field.value]}
                    onValueChange={([v]) => field.onChange(v)}
                  />
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      aria-label="Budget in pesos"
                      placeholder="500000"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v)) field.onChange(v);
                      }}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </div>
                  <p className="text-muted-foreground text-xs">₱{(budget ?? 500000).toLocaleString()}</p>
                </div>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CHOICES.map((choice) => (
              <Controller
                key={choice.name}
                control={form.control}
                name={choice.name}
                render={({ field, fieldState }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={`rec-${choice.name}`} required={choice.required}>
                      {choice.label}
                    </Label>
                    <NativeSelect
                      id={`rec-${choice.name}`}
                      className="w-full"
                      value={(field.value as string | undefined) ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      aria-invalid={fieldState.invalid}
                      aria-required={choice.required}
                    >
                      {choice.placeholder ? (
                        <NativeSelectOption value="" disabled>
                          {choice.placeholder}
                        </NativeSelectOption>
                      ) : null}
                      {choice.options.map((option) => (
                        <NativeSelectOption key={option.value} value={option.value}>
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </div>
                )}
              />
            ))}

            <Controller
              control={form.control}
              name="minYear"
              render={({ field, fieldState }) => (
                <div className="space-y-1.5">
                  <Label htmlFor="rec-min-year" required={false}>
                    Year from
                  </Label>
                  <Input id="rec-min-year" type="number" placeholder="e.g. 2018" {...field} value={field.value ?? ""} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="maxMileage"
              render={({ field, fieldState }) => (
                <div className="space-y-1.5">
                  <Label htmlFor="rec-max-mileage" required={false}>
                    Maximum mileage (km)
                  </Label>
                  <Input
                    id="rec-max-mileage"
                    type="number"
                    placeholder="e.g. 80000"
                    {...field}
                    value={field.value ?? ""}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </div>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="notes"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label htmlFor="rec-notes" required={false}>
                  Anything else we should know
                </Label>
                <Textarea
                  id="rec-notes"
                  rows={2}
                  maxLength={300}
                  placeholder="e.g. good for long drives, low fuel cost"
                  {...field}
                  value={field.value ?? ""}
                />
              </div>
            )}
          />

          <div className="space-y-2">
            <FieldLabel className="flex items-center gap-1.5">
              <SlidersHorizontal className="size-4" />
              Scoring Criteria
            </FieldLabel>
            <div className="flex flex-wrap gap-3">
              {weights.map((w) => (
                <div key={w.key} className="flex flex-col gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {w.label}: {w.pct}
                  </Badge>
                  <p className="text-muted-foreground text-xs">{plainHintByLabel[w.label]}</p>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={running} className="w-full">
            {running ? "Analyzing vehicles..." : "Get Recommendations"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
