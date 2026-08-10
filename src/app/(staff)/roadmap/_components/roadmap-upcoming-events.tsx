"use client";

import { addDays, format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { UpcomingEventData } from "./roadmap-dashboard-data";

interface RoadmapUpcomingEventsProps {
  events: UpcomingEventData[];
  onSelect: (id: string) => void;
}

export function RoadmapUpcomingEvents({ events, onSelect }: RoadmapUpcomingEventsProps) {
  const today = new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Upcoming Milestones</CardTitle>
        <CardAction className="flex items-center gap-1 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            View All <ArrowRight className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {events.map((event) => {
          const eventDate = addDays(today, event.dayOffset);

          return (
            <button
              type="button"
              key={event.id}
              onClick={() => onSelect(event.id)}
              className="group -m-1 flex cursor-pointer items-center justify-between gap-4 rounded-md p-1 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <div className="size-11 shrink-0 overflow-hidden rounded-sm border">
                  <div className="grid h-1/3 place-items-center border-b bg-muted font-medium text-[10px] uppercase leading-none">
                    {format(eventDate, "MMM")}
                  </div>
                  <div className="grid h-2/3 place-items-center text-lg leading-none">{format(eventDate, "d")}</div>
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                  <div className="truncate font-medium text-sm leading-none">{event.title}</div>
                  <div className="text-muted-foreground text-xs leading-none">{event.time}</div>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 rounded-md px-2.5 py-1 font-medium text-[10px]">
                {event.type}
              </Badge>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
