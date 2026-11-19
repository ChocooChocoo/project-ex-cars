"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import {
  computePerformanceHighlights,
  computeProjects,
  computeSchedule,
  computeUpcomingEvents,
} from "./_components/roadmap-dashboard-data";
import { RoadmapDashboardShell } from "./_components/roadmap-dashboard-shell";
import type { RoadmapItem } from "./_components/roadmap-types";

const ROADMAP_READER_ROLES: GceRole[] = ["ceo", "account_manager", "sales_manager"];

// Roadmap is the CEO-owned business-milestone planner: it tracks GCE business milestones (sales pushes,
// showroom openings, field operations), not software sprints. GCE has no IT department, so the legacy
// IT-team template residue (Platform/Backend/Frontend team tags) was replaced with GCE business teams in
// ROADMAP_TEAMS. Writers stay CEO-only; readers (account_manager, sales_manager) keep read access.
export default function RoadmapPage() {
  const allowed = useRequireRole(ROADMAP_READER_ROLES);
  // Phase 7: Laravel serves the roadmap to its readers only (policy gap 3: customers no longer read it).
  const page = usePageData(allowed ? "roadmap" : "roadmap:denied", () =>
    allowed
      ? browserApi<{ canWrite: boolean; items: RoadmapItem[] }>("GET", "/api/v1/staff/roadmap")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const allItems = page.data.items;

  const projects = computeProjects(allItems);
  const highlights = computePerformanceHighlights(allItems);
  const events = computeUpcomingEvents(allItems);
  const schedule = computeSchedule(allItems);

  const canWrite = page.data.canWrite;

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
