import { ArrowUpRight, CircleDashed, CircleDot, Flag, Minus, Pause } from "lucide-react";

import type { RoadmapKind, RoadmapPriority, RoadmapStatus } from "@/lib/validation/roadmap";

export const ROADMAP_KIND_LABELS: Record<RoadmapKind, string> = {
  initiative: "Initiative",
  epic: "Epic",
  feature: "Feature",
};

export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
};

export const ROADMAP_STATUS_CLASSES: Record<RoadmapStatus, string> = {
  planned: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  in_progress: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  completed: "bg-green-600/10 text-green-700 dark:bg-green-600/15 dark:text-green-400",
  on_hold: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

export const ROADMAP_STATUS_BORDERS: Record<RoadmapStatus, string> = {
  planned: "border-blue-500/50 dark:border-blue-400/40",
  in_progress: "border-emerald-500/50 dark:border-emerald-400/40",
  completed: "border-green-600/50 dark:border-green-500/40",
  on_hold: "border-amber-500/50 dark:border-amber-400/40",
};

export const ROADMAP_STATUS_DOTS: Record<RoadmapStatus, string> = {
  planned: "bg-blue-500 dark:bg-blue-400",
  in_progress: "bg-emerald-500 dark:bg-emerald-400",
  completed: "bg-green-600 dark:bg-green-500",
  on_hold: "bg-amber-500 dark:bg-amber-400",
};

export const ROADMAP_PRIORITY_LABELS: Record<RoadmapPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ROADMAP_PRIORITY_CONFIG: Record<RoadmapPriority, { icon: typeof Flag; className: string; label: string }> =
  {
    high: { icon: Flag, className: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300", label: "High" },
    medium: {
      icon: ArrowUpRight,
      className: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      label: "Medium",
    },
    low: {
      icon: Minus,
      className: "bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
      label: "Low",
    },
  };

export const ROADMAP_STATUS_ICONS: Record<RoadmapStatus, typeof CircleDot> = {
  planned: CircleDashed,
  in_progress: CircleDot,
  completed: Flag,
  on_hold: Pause,
};
