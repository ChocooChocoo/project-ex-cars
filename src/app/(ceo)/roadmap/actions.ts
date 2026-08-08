"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { roadmapItemSchema } from "@/lib/validation/roadmap";

const ROADMAP_WRITER_ROLES = ["ceo", "account_manager", "sales_manager"];

type RoadmapActionResult = { error: string } | { success: true; id?: string };

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

type WriterContext = { ok: true; supabase: ServerSupabase; userId: string } | { ok: false; error: string };

async function assertRoadmapWriter(): Promise<WriterContext> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !ROADMAP_WRITER_ROLES.includes(role)) {
    return { ok: false, error: "Not authorized" };
  }

  return { ok: true, supabase, userId: user.user.id };
}

function toData(data: Record<string, unknown>, includeCreator: boolean, userId?: string) {
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
    ...(includeCreator ? { created_by: userId } : {}),
  };
}

export async function createRoadmapItem(formData: FormData): Promise<RoadmapActionResult> {
  const context = await assertRoadmapWriter();
  if (!context.ok) return { error: context.error };
  const { supabase, userId } = context;

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = roadmapItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid roadmap item." };
  }

  const { data: item, error } = await supabase
    .from("roadmap_items")
    .insert(toData(parsed.data, true, userId))
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/roadmap");
  return { success: true, id: item.id };
}

export async function updateRoadmapItem(formData: FormData): Promise<RoadmapActionResult> {
  const context = await assertRoadmapWriter();
  if (!context.ok) return { error: context.error };
  const { supabase } = context;

  const id = formData.get("id") as string;
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  delete raw.id;
  const parsed = roadmapItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid roadmap item." };
  }

  const { error } = await supabase
    .from("roadmap_items")
    .update({ ...toData(parsed.data, false), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/roadmap");
  return { success: true };
}

export async function deleteRoadmapItem(id: string): Promise<RoadmapActionResult> {
  const context = await assertRoadmapWriter();
  if (!context.ok) return { error: context.error };
  const { supabase } = context;

  const { error } = await supabase.from("roadmap_items").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/roadmap");
  return { success: true };
}
