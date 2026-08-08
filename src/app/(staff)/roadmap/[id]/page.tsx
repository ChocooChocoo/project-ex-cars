import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import {
  ROADMAP_KIND_LABELS,
  ROADMAP_PRIORITY_CONFIG,
  ROADMAP_STATUS_CLASSES,
  ROADMAP_STATUS_LABELS,
} from "../_components/roadmap-config";
import { RoadmapItemDetails } from "../_components/roadmap-item-details";
import type { RoadmapItem } from "../_components/roadmap-types";

export default async function RoadmapItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: item } = await supabase.from("roadmap_items").select("*").eq("id", id).single();
  if (!item) notFound();

  const { data: children } = await supabase
    .from("roadmap_items")
    .select("*")
    .eq("parent_id", id)
    .order("created_at", { ascending: true });

  const roadmapItem = item as RoadmapItem;
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
          <RoadmapItemDetails item={roadmapItem} childItems={(children as RoadmapItem[] | null) ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
