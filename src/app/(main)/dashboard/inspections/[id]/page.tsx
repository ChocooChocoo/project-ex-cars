import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

import { ChecklistForm, type ChecklistEntry, type ChecklistResult } from "../_components/checklist-form";

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: inspection } = await supabase
    .from("vehicle_inspections")
    .select("*, vehicles(make, model, year, stock_code)")
    .eq("id", id)
    .single();

  if (!inspection) notFound();

  const insp = inspection as Record<string, unknown>;
  const vehicles = insp.vehicles as Record<string, unknown> | undefined;

  const { data: checklist } = await supabase
    .from("inspection_checklist_nodes")
    .select("*")
    .eq("active", true)
    .order("display_order");

  const { data: results } = await supabase
    .from("inspection_checklist_results")
    .select("*, part_replacements(*)")
    .eq("inspection_id", id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl leading-none tracking-tight">
          {vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : "Inspection"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Stock: {vehicles?.stock_code as string} · Date:{" "}
          {new Date(insp.inspection_date as string).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChecklistForm
            inspectionId={id}
            checklist={(checklist as Record<string, unknown>[]).map((e) => e as unknown as ChecklistEntry)}
            existingResults={(results as Record<string, unknown>[]).map((r) => r as unknown as ChecklistResult)}
          />
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Condition Score</span>
              <Badge variant={Number(insp.condition_score) >= 70 ? "default" : "secondary"}>
                {insp.condition_score ? `${insp.condition_score}/100` : "—"}
              </Badge>
            </div>
            {(insp.findings as string) ? (
              <div>
                <span className="text-muted-foreground text-sm">Findings</span>
                <p className="text-sm">{insp.findings as string}</p>
              </div>
            ) : null}
            {(insp.recommendation as string) ? (
              <div>
                <span className="text-muted-foreground text-sm">Recommendation</span>
                <p className="text-sm">{insp.recommendation as string}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
