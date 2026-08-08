import type { RoadmapKind, RoadmapPriority, RoadmapQuarter, RoadmapStatus } from "@/lib/validation/roadmap";

export interface RoadmapItem {
  id: string;
  parent_id: string | null;
  kind: RoadmapKind;
  title: string;
  description: string | null;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  quarter: RoadmapQuarter | null;
  year: number | null;
  team: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export type RoadmapFilters = {
  status: RoadmapStatus | "all";
  priority: RoadmapPriority | "all";
  quarter: string | "all";
  team: string | "all";
};

export const ROADMAP_TEAMS = ["Platform", "Backend", "Frontend", "Mobile", "Data", "Design", "QA", "Security"] as const;
