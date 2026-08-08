"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { AlertCircle, Kanban as KanbanIcon, List, Table2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ROADMAP_STATUSES, type RoadmapPriority } from "@/lib/validation/roadmap";

import { ROADMAP_STATUS_CLASSES, ROADMAP_STATUS_LABELS } from "./roadmap-config";
import { RoadmapDetailSheet } from "./roadmap-detail-sheet";
import { RoadmapFilters, type RoadmapSortKey } from "./roadmap-filters";
import { RoadmapItemForm } from "./roadmap-form";
import { RoadmapItemCard } from "./roadmap-item-card";
import { RoadmapSwimlane } from "./roadmap-swimlane";
import type { RoadmapFilters as RoadmapFiltersState, RoadmapItem } from "./roadmap-types";
import { buildRoadmapTree, matchesFilters, type RoadmapNode, sortQuarterKeys } from "./roadmap-utils";

interface RoadmapTimelineProps {
  initialItems: RoadmapItem[];
  canWrite: boolean;
}

const priorityOrder: Record<RoadmapPriority, number> = { high: 0, medium: 1, low: 2 };

export function RoadmapTimeline({ initialItems, canWrite }: RoadmapTimelineProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<RoadmapFiltersState>({
    status: "all",
    priority: "all",
    quarter: "all",
    team: "all",
  });
  const [sortKey, setSortKey] = React.useState<RoadmapSortKey>("quarter");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [expandedEpics, setExpandedEpics] = React.useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = React.useState<RoadmapItem | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<RoadmapItem | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RoadmapItem | null>(null);

  const filteredItems = React.useMemo(
    () =>
      initialItems.filter((item) =>
        matchesFilters(item, query, filters.status, filters.priority, filters.quarter, filters.team),
      ),
    [initialItems, query, filters],
  );

  const tree = React.useMemo(() => buildRoadmapTree(filteredItems), [filteredItems]);
  const initiatives = tree.filter((node) => node.item.kind === "initiative");
  const orphans = tree.filter((node) => node.item.kind !== "initiative");

  const quarterKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const item of filteredItems) {
      if (item.quarter && item.year) keys.add(`${item.quarter}-${item.year}`);
    }
    keys.add("unscheduled");
    return sortQuarterKeys([...keys]);
  }, [filteredItems]);

  const sortedChildren = React.useCallback(
    (children: RoadmapNode[]) => {
      const sorted = [...children];
      if (sortKey === "priority") {
        sorted.sort(
          (a, b) =>
            priorityOrder[a.item.priority] - priorityOrder[b.item.priority] || a.item.title.localeCompare(b.item.title),
        );
      } else if (sortKey === "title") {
        sorted.sort((a, b) => a.item.title.localeCompare(b.item.title));
      } else {
        sorted.sort(
          (a, b) =>
            (a.item.start_date ?? "").localeCompare(b.item.start_date ?? "") ||
            a.item.title.localeCompare(b.item.title),
        );
      }
      return sorted;
    },
    [sortKey],
  );

  const expandInitiativesWithChildren = () => {
    setExpanded((current) => {
      const next = new Set(current);
      for (const node of initiatives) {
        if (node.children.length > 0) next.add(node.item.id);
      }
      return next;
    });
  };

  const collapseAll = () => setExpanded(new Set());

  function handleEdit(item: RoadmapItem) {
    setSelectedItem(null);
    setEditingItem(item);
    setFormOpen(true);
  }

  function handleDeleteConfirmed() {
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
  }

  const selectedChildren = selectedItem ? filteredItems.filter((item) => item.parent_id === selectedItem.id) : [];

  return (
    <Tabs
      defaultValue="timeline"
      className="flex h-[calc(100dvh-var(--dashboard-header-height))] min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate font-semibold text-xl tracking-tight">Product Roadmap</h1>
            <p className="text-muted-foreground text-xs">Initiatives, epics, and features across the timeline.</p>
          </div>
          <TabsList className="hidden w-full *:data-[slot=tabs-trigger]:flex-1 sm:flex sm:w-fit sm:*:data-[slot=tabs-trigger]:flex-none">
            <TabsTrigger value="timeline" className="gap-2">
              <Table2 />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="board" className="gap-2">
              <KanbanIcon />
              Board
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List />
              List
            </TabsTrigger>
          </TabsList>
        </div>

        <RoadmapFilters
          query={query}
          filters={filters}
          sortKey={sortKey}
          canWrite={canWrite}
          onQueryChange={setQuery}
          onFiltersChange={setFilters}
          onSortKeyChange={setSortKey}
          onCreate={() => {
            setEditingItem(null);
            setFormOpen(true);
          }}
        />
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-2 sm:hidden">
        <TabsList className="w-full *:data-[slot=tabs-trigger]:flex-1">
          <TabsTrigger value="timeline" className="gap-2">
            <Table2 />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="board" className="gap-2">
            <KanbanIcon />
            Board
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List />
            List
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <TabsContent value="timeline" className="m-0 min-h-full data-active:flex data-active:flex-col">
          <div className="flex min-h-64 flex-1 items-center justify-center p-6">
            <Empty>
              <EmptyMedia variant="icon">
                <AlertCircle />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No initiatives on the timeline</EmptyTitle>
                <EmptyDescription>
                  Create an initiative to start planning, or adjust the active filters.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
          ) : (
          <div className="scrollbar-thin min-w-0 overflow-x-auto [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1.5">
            <div
              className="grid min-w-max gap-px bg-border"
              style={{ gridTemplateColumns: `minmax(15rem, 18rem) repeat(${quarterKeys.length}, minmax(12rem, 1fr))` }}
            >
              <div className="sticky left-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
                <span className="font-medium text-sm">Initiative</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={expandInitiativesWithChildren}
                    className="h-6 text-xs"
                    type="button"
                  >
                    Expand all
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={collapseAll} className="h-6 text-xs" type="button">
                    Collapse
                  </Button>
                </div>
              </div>
              {quarterKeys.map((key) => (
                <div key={key} className="bg-muted/30 px-3 py-2 text-center font-medium text-muted-foreground text-xs">
                  {key === "unscheduled" ? "Unscheduled" : key.replace("-", " ")}
                </div>
              ))}

              {initiatives.map((node) => (
                <RoadmapSwimlane
                  key={node.item.id}
                  node={node}
                  quarterKeys={quarterKeys}
                  expanded={expanded.has(node.item.id)}
                  expandedEpics={expandedEpics}
                  onToggle={() => {
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(node.item.id)) {
                        next.delete(node.item.id);
                      } else {
                        next.add(node.item.id);
                      }
                      return next;
                    });
                  }}
                  onToggleEpic={(epicId) => {
                    setExpandedEpics((current) => {
                      const next = new Set(current);
                      if (next.has(epicId)) {
                        next.delete(epicId);
                      } else {
                        next.add(epicId);
                      }
                      return next;
                    });
                  }}
                  onSelect={setSelectedItem}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="board" className="m-0 min-h-full data-active:flex data-active:flex-col">
          {filteredItems.length === 0 ? (
            <div className="flex min-h-64 flex-1 items-center justify-center p-6">
              <Empty>
                <EmptyMedia variant="icon">
                  <AlertCircle />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No items match the current filters</EmptyTitle>
                  <EmptyDescription>Adjust the filters or search query to see roadmap items.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {ROADMAP_STATUSES.map((status) => {
                const items = filteredItems
                  .filter((item) => item.status === status)
                  .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

                return (
                  <section key={status} className="flex min-w-0 flex-col gap-2 rounded-xl border bg-muted/25 p-3">
                    <header className="flex items-center justify-between gap-2 px-1">
                      <Badge
                        variant="secondary"
                        className={cn("rounded-md border-transparent font-semibold", ROADMAP_STATUS_CLASSES[status])}
                      >
                        {ROADMAP_STATUS_LABELS[status]}
                      </Badge>
                      <span className="text-muted-foreground text-xs tabular-nums">{items.length}</span>
                    </header>
                    <div className="flex flex-col gap-2">
                      {items.map((item) => (
                        <RoadmapItemCard key={item.id} item={item} onSelect={setSelectedItem} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="m-0 min-h-full data-active:flex data-active:flex-col">
          {filteredItems.length === 0 ? (
            <div className="flex min-h-64 flex-1 items-center justify-center p-6">
              <Empty>
                <EmptyMedia variant="icon">
                  <AlertCircle />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No items match the current filters</EmptyTitle>
                  <EmptyDescription>Adjust the filters or search query to see roadmap items.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="flex flex-col gap-6 p-4 lg:p-6">
              {initiatives.map((node) => {
                const epics = sortedChildren(node.children.filter((child) => child.item.kind === "epic"));
                const orphanFeatures = sortedChildren(node.children.filter((child) => child.item.kind === "feature"));

                return (
                  <div key={node.item.id} className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedItem(node.item)}
                      className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                    >
                      <h2 className="truncate font-semibold text-lg tracking-tight">{node.item.title}</h2>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0 rounded-md border-transparent font-semibold",
                          ROADMAP_STATUS_CLASSES[node.item.status],
                        )}
                      >
                        {ROADMAP_STATUS_LABELS[node.item.status]}
                      </Badge>
                    </button>

                    {epics.length === 0 && orphanFeatures.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No epics or features yet.</p>
                    ) : null}

                    <div className="flex flex-col gap-2">
                      {epics.map((epicNode) => (
                        <div key={epicNode.item.id} className="flex flex-col gap-2 rounded-lg border p-3">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(epicNode.item)}
                            className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                          >
                            <span className="font-medium text-muted-foreground text-xs">Epic</span>
                            <span className="min-w-0 truncate font-medium text-sm">{epicNode.item.title}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "ml-auto shrink-0 rounded-md border-transparent px-1.5 font-semibold text-[10px]",
                                ROADMAP_STATUS_CLASSES[epicNode.item.status],
                              )}
                            >
                              {ROADMAP_STATUS_LABELS[epicNode.item.status]}
                            </Badge>
                          </button>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {sortedChildren(epicNode.children).map((featureNode) => (
                              <RoadmapItemCard
                                key={featureNode.item.id}
                                item={featureNode.item}
                                onSelect={setSelectedItem}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      {orphanFeatures.map((featureNode) => (
                        <RoadmapItemCard key={featureNode.item.id} item={featureNode.item} onSelect={setSelectedItem} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {orphans.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h2 className="font-semibold text-lg tracking-tight">Unassigned items</h2>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {orphans.map((node) => (
                      <RoadmapItemCard key={node.item.id} item={node.item} onSelect={setSelectedItem} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </TabsContent>
      </div>

      <RoadmapDetailSheet
        item={selectedItem}
        childItems={selectedChildren}
        canWrite={canWrite}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        onEdit={handleEdit}
        onDelete={(item) => {
          setSelectedItem(null);
          setDeleteTarget(item);
        }}
      />

      <RoadmapItemForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingItem(null);
        }}
        items={initialItems}
        editingItem={editingItem}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete roadmap item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium text-foreground">“{deleteTarget.title}”</span> and all of its child items
                  will be permanently removed.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirmed}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}
