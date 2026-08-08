"use client";

import { ChevronDown, ChevronRight, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import {
  ROADMAP_STATUS_BORDERS,
  ROADMAP_STATUS_CLASSES,
  ROADMAP_STATUS_DOTS,
  ROADMAP_STATUS_LABELS,
} from "./roadmap-config";
import { RoadmapItemCard } from "./roadmap-item-card";
import type { RoadmapItem } from "./roadmap-types";
import { computeProgress, type RoadmapNode } from "./roadmap-utils";

interface RoadmapSwimlaneProps {
  node: RoadmapNode;
  quarterKeys: string[];
  expanded: boolean;
  expandedEpics: Set<string>;
  onToggle: () => void;
  onToggleEpic: (epicId: string) => void;
  onSelect: (item: RoadmapItem) => void;
}

export function RoadmapSwimlane({
  node,
  quarterKeys,
  expanded,
  expandedEpics,
  onToggle,
  onToggleEpic,
  onSelect,
}: RoadmapSwimlaneProps) {
  const initiative = node.item;
  const progress = computeProgress(node);
  const epics = node.children.filter((child) => child.item.kind === "epic");
  const orphanFeatures = node.children.filter((child) => child.item.kind === "feature");

  const byQuarter = (items: RoadmapNode[]) => {
    const map = new Map<string, RoadmapNode[]>();
    for (const entry of items) {
      const key = entry.item.quarter && entry.item.year ? `${entry.item.quarter}-${entry.item.year}` : "unscheduled";
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    return map;
  };

  const epicsByQuarter = byQuarter(epics);
  const featuresByQuarter = byQuarter(orphanFeatures);

  return (
    <div className="contents">
      <div className="sticky left-0 z-10 flex flex-col gap-2 border-r bg-background p-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 truncate font-medium text-sm">{initiative.title}</span>
        </button>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "rounded-md border-transparent px-1.5 font-semibold text-[10px]",
              ROADMAP_STATUS_CLASSES[initiative.status],
            )}
          >
            {ROADMAP_STATUS_LABELS[initiative.status]}
          </Badge>
          <span className="flex items-center gap-1 text-muted-foreground text-xs">
            <Layers className="size-3" />
            {epics.length} epics
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-1.5" />
          <span className="text-muted-foreground text-xs tabular-nums">{progress}%</span>
        </div>
      </div>

      {quarterKeys.map((key) => {
        const epicsInQuarter = epicsByQuarter.get(key) ?? [];
        const featuresInQuarter = featuresByQuarter.get(key) ?? [];

        return (
          <div
            key={key}
            className={cn("flex min-h-24 flex-col gap-2 border-b p-2", !expanded && "items-start justify-start")}
          >
            {expanded
              ? [
                  ...epicsInQuarter.map((epicNode) => {
                    const epic = epicNode.item;
                    const epicExpanded = expandedEpics.has(epic.id);
                    const features = epicNode.children.filter((child) => child.item.kind === "feature");

                    return (
                      <div
                        key={epic.id}
                        className={cn(
                          "flex w-full flex-col gap-1.5 rounded-lg border-l-2 bg-card p-2.5 shadow-xs",
                          ROADMAP_STATUS_BORDERS[epic.status],
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleEpic(epic.id)}
                          className="flex min-w-0 items-center gap-1.5 text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                        >
                          {features.length > 0 ? (
                            epicExpanded ? (
                              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                            )
                          ) : null}
                          <span className="min-w-0 flex-1 truncate font-medium text-sm" title={epic.title}>
                            {epic.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "shrink-0 rounded-md border-transparent px-1.5 font-semibold text-[10px]",
                              ROADMAP_STATUS_CLASSES[epic.status],
                            )}
                          >
                            {ROADMAP_STATUS_LABELS[epic.status]}
                          </Badge>
                        </button>
                        {epicExpanded
                          ? features.map((featureNode) => (
                              <button
                                key={featureNode.item.id}
                                type="button"
                                onClick={() => onSelect(featureNode.item)}
                                className="ml-4 flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                              >
                                <span
                                  className={cn(
                                    "size-1.5 shrink-0 rounded-full",
                                    ROADMAP_STATUS_DOTS[featureNode.item.status],
                                  )}
                                />
                                <span className="min-w-0 truncate" title={featureNode.item.title}>
                                  {featureNode.item.title}
                                </span>
                              </button>
                            ))
                          : null}
                      </div>
                    );
                  }),
                  ...featuresInQuarter.map((featureNode) => (
                    <RoadmapItemCard
                      key={featureNode.item.id}
                      item={featureNode.item}
                      onSelect={onSelect}
                      className="border-dashed"
                    />
                  )),
                ]
              : null}
          </div>
        );
      })}
    </div>
  );
}
