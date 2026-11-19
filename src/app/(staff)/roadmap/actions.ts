"use client";

import { apiAction } from "@/lib/api/action";
import { roadmapItemSchema } from "@/lib/validation/roadmap";

// Phase 7: browser adapters for the Laravel roadmap endpoints (RoadmapController, CEO writes).

type RoadmapActionResult = { error: string } | { success: true; id?: string };

function toData(data: Record<string, unknown>) {
  return {
    parent_id: data.parent_id || null,
    kind: data.kind,
    title: data.title,
    description: data.description || null,
    status: data.status,
    priority: data.priority,
    quarter: data.quarter || null,
    year: data.year ?? null,
    team: data.team || null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
  };
}

async function done(path: string, body?: unknown, method: "POST" | "DELETE" = "POST"): Promise<RoadmapActionResult> {
  const result = await apiAction<{ id?: string }>(path, body, method);
  if (result.error !== undefined) return { error: result.error };
  return result.id ? { success: true, id: result.id } : { success: true };
}

export async function createRoadmapItem(formData: FormData): Promise<RoadmapActionResult> {
  const parsed = roadmapItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid roadmap item." };
  return done("/staff/roadmap", toData(parsed.data));
}

export async function updateRoadmapItem(formData: FormData): Promise<RoadmapActionResult> {
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const id = raw.id;
  delete raw.id;
  const parsed = roadmapItemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid roadmap item." };
  return done("/staff/roadmap/update", { id, ...toData(parsed.data) });
}

export async function deleteRoadmapItem(id: string): Promise<RoadmapActionResult> {
  return done(`/staff/roadmap/${encodeURIComponent(id)}`, undefined, "DELETE");
}
