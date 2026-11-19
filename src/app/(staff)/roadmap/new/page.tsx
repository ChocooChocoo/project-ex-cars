"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import { RoadmapItemForm } from "../_components/roadmap-form";
import type { RoadmapItem } from "../_components/roadmap-types";

export default function NewRoadmapItemPage() {
  const allowed = useRequireRole(["ceo"]);
  const page = usePageData(allowed ? "roadmap" : "roadmap:denied", () =>
    allowed ? browserApi<{ items: RoadmapItem[] }>("GET", "/api/v1/staff/roadmap") : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;

  return <RoadmapItemForm open variant="page" items={page.data.items} editingItem={null} />;
}
