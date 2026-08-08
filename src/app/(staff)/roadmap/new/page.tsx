import { createServerSupabase } from "@/lib/supabase/server";

import { RoadmapItemForm } from "../_components/roadmap-form";
import type { RoadmapItem } from "../_components/roadmap-types";

export default async function NewRoadmapItemPage() {
  const supabase = await createServerSupabase();
  const { data: items } = await supabase.from("roadmap_items").select("*");

  return <RoadmapItemForm open variant="page" items={(items as RoadmapItem[] | null) ?? []} editingItem={null} />;
}
