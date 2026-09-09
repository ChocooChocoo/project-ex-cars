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

// GCE business teams (the roadmap is a business-milestone planner, not software sprints — GCE has no IT
// department). Pre-existing rows tagged with legacy IT team names (Platform, Backend, Frontend, Mobile, Data,
// Design, QA) still render under their stored value and can be re-tagged; no data migration was written.
export const ROADMAP_TEAMS = ["Sales", "Finance", "Operations", "Marketing", "Field Operations", "Security"] as const;
