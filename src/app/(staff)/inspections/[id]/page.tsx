import { notFound } from "next/navigation";

import { FileText, MessageSquareText } from "lucide-react";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/auth/guards";
import type { GceRole } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

import { type ChecklistEntry, ChecklistForm, type ChecklistResult } from "../_components/checklist-form";

const INSPECTION_VIEWER_ROLES: GceRole[] = [
  "ceo",
  "account_manager",
  "confidential_informant",
  "mechanic",
  "sales_manager",
];

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(INSPECTION_VIEWER_ROLES);
  const { id } = await params;
  const supabase = await createServerSupabase();
  const role = await getCurrentRole();

  const { data: inspection } = await supabase
    .from("vehicle_inspections")
    .select("*, vehicles(make, model, year, stock_code)")
    .eq("id", id)
    .single();

  if (!inspection) notFound();

  const insp = inspection as Record<string, unknown>;
  const vehicles = insp.vehicles as Record<string, unknown> | undefined;
  const conditionScore = Number(insp.condition_score);

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
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">
          {vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : "Inspection"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Stock: {vehicles?.stock_code as string} · Date:{" "}
          {new Date(insp.inspection_date as string).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {role === "mechanic" ? (
          <div className="lg:col-span-2">
            <ChecklistForm
              inspectionId={id}
              checklist={(checklist as Record<string, unknown>[]).map((e) => e as unknown as ChecklistEntry)}
              existingResults={(results as Record<string, unknown>[]).map((r) => r as unknown as ChecklistResult)}
            />
          </div>
        ) : null}
        <Card className={role === "mechanic" ? "h-fit" : "h-fit lg:col-span-3"}>
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Condition Score</span>
                <Badge variant={conditionScore >= 70 ? "default" : "secondary"}>
                  {insp.condition_score ? `${insp.condition_score}/100` : "—"}
                </Badge>
              </div>
              {insp.condition_score ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${conditionScore >= 70 ? "bg-emerald-500" : conditionScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${conditionScore}%` }}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">Not scored</p>
              )}
            </div>
            {(insp.findings as string) ? (
              <>
                <Separator />
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">Findings</span>
                  </div>
                  <p className="text-sm leading-relaxed">{insp.findings as string}</p>
                </div>
              </>
            ) : null}
            {(insp.recommendation as string) ? (
              <>
                {(insp.findings as string) ? <Separator /> : null}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <MessageSquareText className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">Recommendation</span>
                  </div>
                  <p className="text-sm leading-relaxed">{insp.recommendation as string}</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
