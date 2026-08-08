import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { sampleRoadmapItems } from "./_components/data";
import { RoadmapTimeline } from "./_components/roadmap-timeline";
import type { RoadmapItem } from "./_components/roadmap-types";

const ROADMAP_WRITER_ROLES = ["ceo", "account_manager", "sales_manager"];

export default async function RoadmapPage() {
  const supabase = await createServerSupabase();
  const role = await getCurrentRole();

  const { data: items } = await supabase.from("roadmap_items").select("*").order("created_at", { ascending: true });

  return (
    <div data-content-padding="false">
      <RoadmapTimeline
        initialItems={(items as RoadmapItem[] | null) ?? sampleRoadmapItems}
        canWrite={!!role && ROADMAP_WRITER_ROLES.includes(role)}
      />
    </div>
  );
}
