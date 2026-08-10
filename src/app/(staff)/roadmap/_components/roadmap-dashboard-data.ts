import { differenceInDays, format, parseISO } from "date-fns";

import type { RoadmapItem } from "./roadmap-types";
import { buildRoadmapTree, computeProgress } from "./roadmap-utils";

export interface ProjectCardData {
  id: string;
  title: string;
  status: string;
  description: string;
  progress: number;
  due: string;
  team: string;
}

export interface PerformanceHighlightData {
  team: string;
  start: number;
  duration: number;
  subject: string;
  score: number;
  initials: string[];
}

export interface UpcomingEventData {
  id: string;
  dayOffset: number;
  title: string;
  time: string;
  type: string;
}

export interface ScheduleEntryData {
  id: string;
  time: string;
  date: string;
  title: string;
  subtitle: string;
  status: "In Progress" | "Upcoming" | "Cancelled";
}

function capitalize(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeProjects(items: RoadmapItem[]): ProjectCardData[] {
  const tree = buildRoadmapTree(items);
  const initiatives = tree.filter((node) => node.item.kind === "initiative");

  return initiatives.map((node) => {
    const item = node.item;
    const progress = computeProgress(node);
    const due = item.end_date ? `Due ${format(parseISO(item.end_date), "MMM d")}` : "No due date";
    const status = capitalize(item.status);

    return {
      id: item.id,
      title: item.title,
      status,
      description: item.description ?? "No description",
      progress,
      due,
      team: item.team ?? "",
    };
  });
}

export function computePerformanceHighlights(items: RoadmapItem[]): PerformanceHighlightData[] {
  const teamMap = new Map<string, RoadmapItem[]>();
  for (const item of items) {
    if (!item.team) continue;
    const list = teamMap.get(item.team);
    if (list) {
      list.push(item);
    } else {
      teamMap.set(item.team, [item]);
    }
  }

  const teams = Array.from(teamMap.entries());
  const n = teams.length;
  if (n === 0) return [];

  const gap = 4 / n;

  return teams.map(([team, teamItems], i) => {
    const completed = teamItems.filter((item) => item.status === "completed").length;
    const score = Math.round((completed / teamItems.length) * 100);
    const activeItem = teamItems.find((item) => item.status === "in_progress") ?? teamItems[0];
    const subject = activeItem.title;
    const initials = team.slice(0, 2).toUpperCase();

    return {
      team,
      start: i * gap,
      duration: gap * 0.75,
      subject,
      score,
      initials: [initials],
    };
  });
}

export function computeUpcomingEvents(items: RoadmapItem[]): UpcomingEventData[] {
  const today = new Date();

  const withDates = items
    .filter((item) => item.start_date || item.end_date)
    .map((item) => {
      const start = item.start_date ? parseISO(item.start_date) : null;
      const end = item.end_date ? parseISO(item.end_date) : null;

      const pivot: Date = start && start >= today ? start : (end ?? start ?? today);
      const dayOffset = differenceInDays(pivot, today);

      return { item, dayOffset };
    })
    .filter((entry) => entry.dayOffset >= 0)
    .sort((a, b) => a.dayOffset - b.dayOffset)
    .slice(0, 5);

  return withDates.map(({ item, dayOffset }) => {
    let time: string;
    if (item.start_date && item.end_date) {
      time = `${format(parseISO(item.start_date), "MMM d")} - ${format(parseISO(item.end_date), "MMM d")}`;
    } else if (item.start_date) {
      time = format(parseISO(item.start_date), "MMM d, yyyy");
    } else if (item.end_date) {
      time = format(parseISO(item.end_date), "MMM d, yyyy");
    } else {
      time = "TBD";
    }

    return {
      id: item.id,
      dayOffset,
      title: item.title,
      time,
      type: capitalize(item.kind),
    };
  });
}

export function computeSchedule(items: RoadmapItem[]): ScheduleEntryData[] {
  const scheduleItems = items.filter((item) => item.status !== "completed").slice(0, 5);

  return scheduleItems.map((item) => {
    const dateStr = item.start_date ? format(parseISO(item.start_date), "EEEE, d MMMM") : "Unscheduled";

    let time: string;
    if (item.start_date && item.end_date) {
      time = `${format(parseISO(item.start_date), "MMM d")} - ${format(parseISO(item.end_date), "MMM d")}`;
    } else if (item.quarter && item.year) {
      time = `${item.quarter} ${item.year}`;
    } else {
      time = "TBD";
    }

    const statusMap: Record<string, ScheduleEntryData["status"]> = {
      in_progress: "In Progress",
      planned: "Upcoming",
      on_hold: "Cancelled",
    };

    return {
      id: item.id,
      time,
      date: dateStr,
      title: item.title,
      subtitle: item.team ? `${item.team} \u2022 ${capitalize(item.kind)}` : capitalize(item.kind),
      status: statusMap[item.status] ?? "Upcoming",
    };
  });
}
