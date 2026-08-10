import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { sampleRoadmapItems } from "./_components/data";
import {
  computePerformanceHighlights,
  computeProjects,
  computeSchedule,
  computeUpcomingEvents,
} from "./_components/roadmap-dashboard-data";
import { RoadmapDashboardShell } from "./_components/roadmap-dashboard-shell";
import type { RoadmapItem } from "./_components/roadmap-types";

const ROADMAP_WRITER_ROLES = ["ceo", "account_manager", "sales_manager"];

export default async function RoadmapPage() {
  const supabase = await createServerSupabase();
  const role = await getCurrentRole();

  const { data: items } = await supabase.from("roadmap_items").select("*").order("created_at", { ascending: true });

  const allItems = (items as RoadmapItem[] | null) ?? sampleRoadmapItems;

  const projects = computeProjects(allItems);
  const highlights = computePerformanceHighlights(allItems);
  const events = computeUpcomingEvents(allItems);
  const schedule = computeSchedule(allItems);

  const canWrite = !!role && ROADMAP_WRITER_ROLES.includes(role);

  return (
    <RoadmapDashboardShell
      items={allItems}
      projects={projects}
      highlights={highlights}
      events={events}
      schedule={schedule}
      canWrite={canWrite}
    />
  );
}
