"use client";

import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import { useRouteParam } from "@/lib/routing/use-route-param";
import { cn } from "@/lib/utils";

import {
  ROADMAP_KIND_LABELS,
  ROADMAP_PRIORITY_CONFIG,
  ROADMAP_STATUS_CLASSES,
  ROADMAP_STATUS_LABELS,
} from "./roadmap-config";
import { RoadmapItemDetails } from "./roadmap-item-details";
import type { RoadmapItem } from "./roadmap-types";

export function RoadmapItemPage() {
  const id = useRouteParam("roadmap");
  const allowed = useRequireRole(["ceo", "account_manager", "sales_manager"]);
  const page = usePageData(allowed && id ? `roadmap:${id}` : "roadmap:none", () =>
    allowed && id
      ? browserApi<{ item: RoadmapItem; children: RoadmapItem[] }>("GET", `/api/v1/staff/roadmap/${id}`).catch(
          (error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return null;
            throw error;
          },
        )
      : Promise.resolve(undefined),
  );
  if (page.error) throw page.error;
  if (!allowed || !id || page.data === undefined) return <PageSkeleton />;
  if (page.data === null) {
    return <h1 className="font-semibold text-3xl tracking-tight">Roadmap item not found</h1>;
  }
  const roadmapItem = page.data.item;
  const children = page.data.children;
  const priority = ROADMAP_PRIORITY_CONFIG[roadmapItem.priority];
  const PriorityIcon = priority.icon;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
            <Link href="/dashboard/roadmap">
              <ArrowLeft data-icon="inline-start" />
              Back to roadmap
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl leading-none tracking-tight">{roadmapItem.title}</h1>
            <Badge variant="secondary" className="rounded-md border-transparent px-2 font-semibold">
              {ROADMAP_KIND_LABELS[roadmapItem.kind]}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "rounded-md border-transparent px-2 font-semibold",
                ROADMAP_STATUS_CLASSES[roadmapItem.status],
              )}
            >
              {ROADMAP_STATUS_LABELS[roadmapItem.status]}
            </Badge>
            <Badge
              variant="secondary"
              className={cn("rounded-md border-transparent px-2 font-semibold", priority.className)}
            >
              <PriorityIcon />
              {priority.label}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{roadmapItem.description || "No description provided."}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <RoadmapItemDetails item={roadmapItem} childItems={children} />
        </CardContent>
      </Card>
    </div>
  );
}
