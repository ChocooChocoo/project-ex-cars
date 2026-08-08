"use client";
"use no memo";

import { useEffect, useState } from "react";

import { ChevronDown, ChevronUp, Star, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  explainScores,
  type ScoredVehicle,
  type ScoreExplanation,
  type VehicleInput,
} from "@/lib/recommendations/engine";
import { cn, formatCurrency } from "@/lib/utils";

import { getRecommendationRun, submitFeedback } from "../actions";

interface RecommendationResultsProps {
  readonly runId: string;
}

interface VehicleDisplay {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  condition: string;
  mileage: number | null;
  fuelType: string;
  bodyType: string;
}

interface ResultWithExplanation {
  scored: ScoredVehicle;
  explanation: ScoreExplanation;
  vehicle: VehicleDisplay;
}

const medalColors = ["bg-amber-500", "bg-slate-400", "bg-amber-700"];

export function RecommendationResults({ runId }: RecommendationResultsProps) {
  const [results, setResults] = useState<ResultWithExplanation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, "helpful" | "not_helpful" | null>>({});

  useEffect(() => {
    async function load() {
      const res = await getRecommendationRun(runId);
      if (res.error) {
        toast.error(res.error);
        setLoading(false);
        return;
      }

      const vehicleIds = (res.results as Record<string, unknown>[]).map((r) => r.vehicle_id as string);
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id, make, model, year, current_price, condition, mileage, fuel_type, body_type")
        .in("id", vehicleIds);

      const vehicleMap = new Map<string, VehicleDisplay>();
      for (const v of vehicles ?? []) {
        vehicleMap.set(v.id, {
          id: v.id,
          make: v.make as string,
          model: v.model as string,
          year: v.year as number,
          price: (v.current_price as number) ?? 0,
          condition: v.condition as string,
          mileage: v.mileage as number | null,
          fuelType: v.fuel_type as string,
          bodyType: v.body_type as string,
        });
      }

      const enriched = (res.results as Record<string, unknown>[]).map((r) => {
        const vehicle = vehicleMap.get(r.vehicle_id as string) ?? {
          id: r.vehicle_id as string,
          make: "Unknown",
          model: "",
          year: 0,
          price: 0,
          condition: "unknown",
          mileage: null,
          fuelType: "unknown",
          bodyType: "",
        };

        const scored: ScoredVehicle = {
          vehicleId: r.vehicle_id as string,
          budgetScore: r.budget_score as number,
          conditionScore: r.condition_score as number,
          fuelScore: r.fuel_score as number,
          demandScore: r.demand_score as number,
          mileageScore: r.mileage_score as number,
          totalScore: r.total_score as number,
          rank: r.rank as number,
        };

        const input: VehicleInput = {
          id: vehicle.id,
          current_price: vehicle.price,
          condition: vehicle.condition,
          mileage: vehicle.mileage,
          fuel_type: vehicle.fuelType,
          make: vehicle.make,
          model: vehicle.model,
          body_type: vehicle.bodyType,
          inspection_score: null,
          favourite_count: 0,
          inquiry_count: 0,
        };

        return { scored, explanation: explainScores(input, scored), vehicle };
      });

      setResults(enriched);
      setLoading(false);
    }
    load().catch(console.error);
  }, [runId]);

  async function handleFeedback(vehicleId: string, helpful: boolean) {
    const result = await submitFeedback(runId, vehicleId, helpful);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setFeedbackState((prev) => ({ ...prev, [vehicleId]: helpful ? "helpful" : "not_helpful" }));
    toast.success("Thank you for your feedback!");
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <Trophy className="size-8 opacity-40" />
          <p>No results found for this recommendation run.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-amber-500" />
        <h2 className="font-semibold text-xl tracking-tight">Ranked Recommendations</h2>
      </div>

      <ScrollArea className="max-h-[70vh]">
        <div className="flex flex-col gap-3">
          {results.map(({ scored, explanation, vehicle }, idx) => (
            <Card key={scored.vehicleId} className={cn(idx === 0 && "ring-2 ring-amber-500/50")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full font-bold text-white text-xs",
                        idx < 3 ? medalColors[idx] : "bg-muted-foreground/30",
                      )}
                    >
                      {scored.rank}
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {vehicle.make} {vehicle.model} {vehicle.year}
                      </CardTitle>
                      <p className="text-muted-foreground text-xs">
                        {vehicle.bodyType} · {vehicle.fuelType} · {vehicle.condition}
                        {vehicle.mileage != null && ` · ${vehicle.mileage.toLocaleString()} km`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="default" className="text-xs">
                      {formatCurrency(vehicle.price)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Score: {scored.totalScore}/100
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Collapsible
                  open={expandedId === scored.vehicleId}
                  onOpenChange={(open) => setExpandedId(open ? scored.vehicleId : null)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                      {expandedId === scored.vehicleId ? (
                        <ChevronUp className="size-3" />
                      ) : (
                        <ChevronDown className="size-3" />
                      )}
                      Score Breakdown
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2">
                      {explanation.criteria.map((c) => (
                        <div key={c.label} className="rounded-md border p-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{c.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-xs">
                                Weight: {(c.weight * 100).toFixed(0)}%
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {c.score.toFixed(1)}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                            <div
                              className="h-1.5 rounded-full bg-primary transition-all"
                              style={{ width: `${c.score}%` }}
                            />
                          </div>
                          <p className="mt-1 text-muted-foreground text-xs">{c.detail}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {feedbackState[scored.vehicleId] === undefined && (
                  <div className="mt-2 flex items-center gap-2 border-t pt-2">
                    <span className="text-muted-foreground text-xs">Was this helpful?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleFeedback(scored.vehicleId, true)}
                    >
                      <ThumbsUp className="size-3" />
                      Yes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleFeedback(scored.vehicleId, false)}
                    >
                      <ThumbsDown className="size-3" />
                      No
                    </Button>
                  </div>
                )}
                {feedbackState[scored.vehicleId] && (
                  <div className="mt-2 border-t pt-2">
                    <Badge
                      variant={feedbackState[scored.vehicleId] === "helpful" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      <Star className="mr-1 size-3" />
                      Marked as {feedbackState[scored.vehicleId] === "helpful" ? "helpful" : "not helpful"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
