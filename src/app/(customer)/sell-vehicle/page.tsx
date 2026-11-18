"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import { type ConditionChecklistNode, SellVehicleForm } from "./_components/sell-vehicle-form";

export default function SellVehiclePage() {
  const page = usePageData("sell-checklist", () =>
    browserApi<{ nodes: ConditionChecklistNode[] }>("GET", "/api/v1/sell/checklist"),
  );
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;
  const nodes = page.data.nodes;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Sell Your Vehicle</h1>
        <p className="text-muted-foreground text-sm">
          Submit your vehicle for evaluation. A mechanic will inspect it and a Sales Manager will review.
        </p>
      </div>
      <SellVehicleForm checklistNodes={(nodes as ConditionChecklistNode[] | null) ?? []} />
    </div>
  );
}
