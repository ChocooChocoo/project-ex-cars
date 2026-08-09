"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  ROADMAP_KIND_LABELS,
  ROADMAP_PRIORITY_CONFIG,
  ROADMAP_STATUS_CLASSES,
  ROADMAP_STATUS_LABELS,
} from "./roadmap-config";
import { RoadmapItemDetails } from "./roadmap-item-details";
import type { RoadmapItem } from "./roadmap-types";

interface RoadmapDetailSheetProps {
  item: RoadmapItem | null;
  childItems: RoadmapItem[];
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: RoadmapItem) => void;
  onDelete: (item: RoadmapItem) => void;
}

export function RoadmapDetailSheet({
  item,
  childItems,
  canWrite,
  onOpenChange,
  onEdit,
  onDelete,
}: RoadmapDetailSheetProps) {
  if (!item) return null;

  const priority = ROADMAP_PRIORITY_CONFIG[item.priority];
  const PriorityIcon = priority.icon;

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="flex max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-md border-transparent px-2 font-semibold">
              {ROADMAP_KIND_LABELS[item.kind]}
            </Badge>
            <Badge
              variant="secondary"
              className={cn("rounded-md border-transparent px-2 font-semibold", ROADMAP_STATUS_CLASSES[item.status])}
            >
              {ROADMAP_STATUS_LABELS[item.status]}
            </Badge>
            <Badge
              variant="secondary"
              className={cn("rounded-md border-transparent px-2 font-semibold", priority.className)}
            >
              <PriorityIcon />
              {priority.label}
            </Badge>
          </div>
          <SheetTitle className="text-xl leading-6">{item.title}</SheetTitle>
          <SheetDescription>{item.description || "No description provided."}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <RoadmapItemDetails item={item} childItems={childItems} />
        </ScrollArea>

        <SheetFooter className="border-t">
          {canWrite ? (
            <>
              <Button variant="destructive" className="flex-1" onClick={() => onDelete(item)}>
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
              <Button className="flex-1" onClick={() => onEdit(item)}>
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
            </>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
