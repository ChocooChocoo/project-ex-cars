"use client";

import { format } from "date-fns";
import { CalendarDays, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  ROADMAP_KIND_LABELS,
  ROADMAP_PRIORITY_CONFIG,
  ROADMAP_STATUS_CLASSES,
  ROADMAP_STATUS_LABELS,
} from "./roadmap-config";
import type { RoadmapItem } from "./roadmap-types";

interface RoadmapItemDetailsProps {
  item: RoadmapItem;
  childItems: RoadmapItem[];
}

export function RoadmapItemDetails({ item, childItems }: RoadmapItemDetailsProps) {
  const priority = ROADMAP_PRIORITY_CONFIG[item.priority];
  const _PriorityIcon = priority.icon;

  const dateLabel =
    item.start_date || item.end_date
      ? [
          item.start_date ? format(new Date(item.start_date), "MMM d, yyyy") : null,
          item.end_date ? format(new Date(item.end_date), "MMM d, yyyy") : null,
        ]
          .filter(Boolean)
          .join(" – ")
      : "Not scheduled";

  const childLabel = item.kind === "initiative" ? "Epics" : item.kind === "epic" ? "Features" : "Related items";

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-muted-foreground text-xs">Timeline</span>
          <span className="flex items-center gap-1.5 font-medium text-sm">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            {dateLabel}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-muted-foreground text-xs">Quarter</span>
          <span className="font-medium text-sm">
            {item.quarter && item.year ? `${item.quarter} ${item.year}` : "Unscheduled"}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-muted-foreground text-xs">Team</span>
          <span className="flex items-center gap-1.5 font-medium text-sm">
            <Users className="size-3.5 text-muted-foreground" />
            {item.team ?? "Unassigned"}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-muted-foreground text-xs">Created</span>
          <span className="font-medium text-sm">{format(new Date(item.created_at), "MMM d, yyyy")}</span>
        </div>
      </div>

      {childItems.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium text-sm">{childLabel}</h3>
          {childItems.map((child) => (
            <div key={child.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{child.title}</p>
                <p className="text-muted-foreground text-xs">
                  {ROADMAP_KIND_LABELS[child.kind]} ·{" "}
                  {child.quarter && child.year ? `${child.quarter} ${child.year}` : "Unscheduled"}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "shrink-0 rounded-md border-transparent px-1.5 font-semibold text-[10px]",
                  ROADMAP_STATUS_CLASSES[child.status],
                )}
              >
                {ROADMAP_STATUS_LABELS[child.status]}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}

      {item.parent_id ? (
        <p className="text-muted-foreground text-xs">
          Part of a {item.kind === "feature" ? "epic" : "initiative"}. Open the timeline to see its parent item.
        </p>
      ) : null}
    </div>
  );
}
