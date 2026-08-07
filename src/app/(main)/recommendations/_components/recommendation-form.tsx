"use client";
"use no memo";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Car, DollarSign, Fuel, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { getWeightLabels } from "@/lib/recommendations/engine";
import { type RecommendationPreferences, recommendationPreferencesSchema } from "@/lib/validation/recommendations";

import { runRecommendation } from "../actions";

interface RecommendationFormProps {
  readonly onResults: (runId: string) => void;
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
      bodyType: "",
      make: "",
    },
  });

  const budget = form.watch("budget");

  async function onSubmit(data: RecommendationPreferences) {
    setRunning(true);
    try {
      const prefs: Record<string, string> = {};
      if (data.condition && data.condition !== "any") prefs.condition = data.condition;
      if (data.fuel && data.fuel !== "any") prefs.fuel = data.fuel;
      if (data.bodyType) prefs.bodyType = data.bodyType;
      if (data.make) prefs.make = data.make;

      const result = await runRecommendation(data.budget, prefs);
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
          Tell us your budget and preferences. We will rank available vehicles using five weighted criteria.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <div className="space-y-2">
            <FieldLabel className="flex items-center gap-1.5">
              <DollarSign className="size-4" />
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
            <Controller
              control={form.control}
              name="condition"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5">
                    <Car className="size-4" />
                    Condition Preference
                  </FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <option value="any">Any Condition</option>
                    <option value="new">New</option>
                    <option value="certified">Certified</option>
                    <option value="used">Used</option>
                  </Select>
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="fuel"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5">
                    <Fuel className="size-4" />
                    Fuel Preference
                  </FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <option value="any">Any Fuel Type</option>
                    <option value="electric">Electric</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="diesel">Diesel</option>
                    <option value="petrol">Petrol</option>
                  </Select>
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="make"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5">
                    <Search className="size-4" />
                    Make (Optional)
                  </FieldLabel>
                  <Input placeholder="e.g. Toyota" {...field} value={field.value ?? ""} />
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="bodyType"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5">
                    <Car className="size-4" />
                    Body Type (Optional)
                  </FieldLabel>
                  <Input placeholder="e.g. SUV, Sedan" {...field} value={field.value ?? ""} />
                </div>
              )}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel className="flex items-center gap-1.5">
              <SlidersHorizontal className="size-4" />
              Scoring Criteria
            </FieldLabel>
            <div className="flex flex-wrap gap-2">
              {weights.map((w) => (
                <Badge key={w.key} variant="secondary" className="text-xs">
                  {w.label}: {w.pct}
                </Badge>
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
