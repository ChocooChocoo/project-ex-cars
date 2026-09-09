import { createServerSupabase } from "@/lib/supabase/server";

import { type ConditionChecklistNode, SellVehicleForm } from "./_components/sell-vehicle-form";

export default async function SellVehiclePage() {
  const supabase = await createServerSupabase();
  const { data: nodes } = await supabase
    .from("inspection_checklist_nodes")
    .select("id, parent_id, level, name")
    .eq("active", true)
    .order("display_order");

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
