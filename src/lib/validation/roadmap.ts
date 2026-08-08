import { z } from "zod";

export const ROADMAP_KINDS = ["initiative", "epic", "feature"] as const;
export const ROADMAP_STATUSES = ["planned", "in_progress", "completed", "on_hold"] as const;
export const ROADMAP_PRIORITIES = ["high", "medium", "low"] as const;
export const ROADMAP_QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export type RoadmapKind = (typeof ROADMAP_KINDS)[number];
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];
export type RoadmapPriority = (typeof ROADMAP_PRIORITIES)[number];
export type RoadmapQuarter = (typeof ROADMAP_QUARTERS)[number];

const optionalText = z.string().max(500).optional().or(z.literal(""));

export const roadmapItemSchema = z
  .object({
    parent_id: z.string().uuid().optional().or(z.literal("")),
    kind: z.enum(ROADMAP_KINDS),
    title: z.string().min(1, "Title is required.").max(200),
    description: z.string().max(2000).optional().or(z.literal("")),
    status: z.enum(ROADMAP_STATUSES),
    priority: z.enum(ROADMAP_PRIORITIES),
    quarter: z.enum(ROADMAP_QUARTERS).optional().or(z.literal("")),
    year: z.coerce.number().int().min(2000, "Year must be 2000 or later.").max(2100).optional(),
    team: optionalText,
    start_date: z.string().optional().or(z.literal("")),
    end_date: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.kind === "initiative") return data.parent_id === "" || data.parent_id === undefined;
      return data.parent_id !== "" && data.parent_id !== undefined;
    },
    { path: ["parent_id"], message: "Initiatives cannot have a parent; epics and features require one." },
  )
  .refine(
    (data) => {
      if (!data.start_date || !data.end_date) return true;
      return new Date(data.start_date) <= new Date(data.end_date);
    },
    { path: ["end_date"], message: "End date must be on or after the start date." },
  );

export type RoadmapItemFormData = z.infer<typeof roadmapItemSchema>;
