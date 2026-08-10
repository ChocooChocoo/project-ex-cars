"use client";

import { useCallback, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { deleteRoadmapItem } from "@/app/(staff)/roadmap/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { RoadmapClassScheduleSection } from "./roadmap-class-schedule";
import type {
  PerformanceHighlightData,
  ProjectCardData,
  ScheduleEntryData,
  UpcomingEventData,
} from "./roadmap-dashboard-data";
import { RoadmapDetailSheet } from "./roadmap-detail-sheet";
import { RoadmapItemForm } from "./roadmap-form";
import { RoadmapPerformanceHighlights } from "./roadmap-performance-highlights";
import { RoadmapProjectsSection } from "./roadmap-projects";
import type { RoadmapItem } from "./roadmap-types";
import { RoadmapUpcomingEvents } from "./roadmap-upcoming-events";

interface RoadmapDashboardShellProps {
  items: RoadmapItem[];
  projects: ProjectCardData[];
  highlights: PerformanceHighlightData[];
  events: UpcomingEventData[];
  schedule: ScheduleEntryData[];
  canWrite: boolean;
}

export function RoadmapDashboardShell({
  items,
  projects,
  highlights,
  events,
  schedule,
  canWrite,
}: RoadmapDashboardShellProps) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoadmapItem | null>(null);

  const itemsById = useMemo(() => {
    const map = new Map<string, RoadmapItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const handleSelect = useCallback(
    (id: string) => {
      const item = itemsById.get(id);
      if (item) setSelectedItem(item);
    },
    [itemsById],
  );

  const selectedChildren = useMemo(
    () => (selectedItem ? items.filter((item) => item.parent_id === selectedItem.id) : []),
    [items, selectedItem],
  );

  const handleEdit = useCallback((item: RoadmapItem) => {
    setSelectedItem(null);
    setEditingItem(item);
    setFormOpen(true);
  }, []);

  const handleDeleteRequest = useCallback((item: RoadmapItem) => {
    setDeleteTarget(item);
  }, []);

  const handleDeleteConfirmed = useCallback(() => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setSelectedItem(null);
    void deleteRoadmapItem(target.id).then((result) => {
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Roadmap item deleted.");
        router.refresh();
      }
    });
  }, [deleteTarget, router]);

  return (
    <>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <RoadmapProjectsSection projects={projects} onSelect={handleSelect} canWrite={canWrite} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <RoadmapPerformanceHighlights highlights={highlights} />
          </div>
          <div className="xl:col-span-4">
            <RoadmapUpcomingEvents events={events} onSelect={handleSelect} />
          </div>
        </div>
        <RoadmapClassScheduleSection schedule={schedule} onSelect={handleSelect} canWrite={canWrite} />
      </div>

      <RoadmapDetailSheet
        item={selectedItem}
        childItems={selectedChildren}
        canWrite={canWrite}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />

      <RoadmapItemForm
        variant="sheet"
        open={formOpen}
        editingItem={editingItem}
        items={items}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingItem(null);
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Roadmap Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? This action cannot be undone. Child
              items will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
