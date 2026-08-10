"use client";

import { useRouter } from "next/navigation";

import { ArrowRight, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { ScheduleEntryData } from "./roadmap-dashboard-data";

const SCHEDULE_STATUS_STYLES: Record<ScheduleEntryData["status"], { bar: string; badge: string }> = {
  "In Progress": {
    bar: "bg-green-600 dark:bg-green-400",
    badge:
      "shrink-0 rounded-md border-green-600/50 bg-green-50 px-2.5 py-1 font-medium text-[10px] text-green-600 dark:border-green-800/50 dark:bg-green-500/10 dark:text-green-400",
  },
  Upcoming: {
    bar: "bg-yellow-500 dark:bg-yellow-400",
    badge:
      "shrink-0 rounded-md border-yellow-600/50 bg-yellow-50 px-2.5 py-1 font-medium text-[10px] text-yellow-700 dark:border-yellow-800/50 dark:bg-yellow-500/10 dark:text-yellow-300",
  },
  Cancelled: {
    bar: "bg-destructive",
    badge:
      "shrink-0 rounded-md border-destructive/50 bg-destructive/10 px-2.5 py-1 font-medium text-[10px] text-destructive dark:border-destructive/50 dark:bg-destructive/20",
  },
};

interface RoadmapClassScheduleSectionProps {
  schedule: ScheduleEntryData[];
  onSelect: (id: string) => void;
  canWrite: boolean;
}

export function RoadmapClassScheduleSection({ schedule, onSelect, canWrite }: RoadmapClassScheduleSectionProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Active Items</CardTitle>
        <CardAction className="flex items-center gap-1 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            View All <ArrowRight className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        <div className="flex flex-col divide-y divide-border">
          {schedule.map((entry) => {
            const styles = SCHEDULE_STATUS_STYLES[entry.status];

            return (
              <button
                type="button"
                key={entry.id}
                onClick={() => onSelect(entry.id)}
                className="group grid cursor-pointer grid-cols-1 gap-3 bg-card py-3 text-left transition-colors hover:bg-muted/30 sm:grid-cols-[10rem_1fr_auto] sm:items-center"
              >
                <div className="flex gap-2">
                  <div className={`w-1 shrink-0 rounded-md ${styles.bar}`} />
                  <div className="text-nowrap text-xs">
                    <div className="font-medium text-foreground">{entry.time}</div>
                    <div className="text-muted-foreground">{entry.date}</div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                  <div className="truncate font-medium text-foreground text-sm leading-none">{entry.title}</div>
                  <div className="truncate text-muted-foreground text-xs leading-none">{entry.subtitle}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={styles.badge}>
                    {entry.status}
                  </Badge>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/roadmap/${entry.id}?edit=true`);
                      }}
                      className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      aria-label={`Edit ${entry.title}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
