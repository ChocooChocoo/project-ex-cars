"use client";

import { format } from "date-fns";
import { CalendarDays, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ROADMAP_PRIORITY_CONFIG, ROADMAP_STATUS_CLASSES, ROADMAP_STATUS_LABELS } from "./roadmap-config";
import type { RoadmapItem } from "./roadmap-types";

interface RoadmapItemCardProps {
  item: RoadmapItem;
  onSelect: (item: RoadmapItem) => void;
  className?: string;
}

export function RoadmapItemCard({ item, onSelect, className }: RoadmapItemCardProps) {
  const priority = ROADMAP_PRIORITY_CONFIG[item.priority];
  const PriorityIcon = priority.icon;
  const hasDates = item.start_date ?? item.end_date;

  const dateLabel = hasDates
    ? [
        item.start_date ? format(new Date(item.start_date), "MMM d") : null,
        item.end_date ? format(new Date(item.end_date), "MMM d") : null,
      ]
        .filter(Boolean)
        .join(" – ")
    : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors",
        "hover:border-foreground/20 hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h4 className="min-w-0 truncate font-medium text-sm leading-5">{item.title}</h4>
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 rounded-md border-transparent px-1.5 font-semibold text-[10px]",
            ROADMAP_STATUS_CLASSES[item.status],
          )}
        >
          {ROADMAP_STATUS_LABELS[item.status]}
        </Badge>
      </div>

      {item.description ? (
        <p className="line-clamp-2 text-muted-foreground text-xs leading-5">{item.description}</p>
      ) : null}

      <div className="mt-auto flex items-center gap-2 text-muted-foreground text-xs">
        <span className={cn("flex items-center gap-1", priority.className)}>
          <PriorityIcon className="size-3" />
          {priority.label}
        </span>
        {item.team ? (
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {item.team}
          </span>
        ) : null}
        {dateLabel ? (
          <span className="ml-auto flex items-center gap-1">
            <CalendarDays className="size-3" />
            <span className="tabular-nums">{dateLabel}</span>
          </span>
        ) : null}
      </div>
    </button>
  );
}
