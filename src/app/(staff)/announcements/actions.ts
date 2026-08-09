"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { announcementSchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

export async function createAnnouncement(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (role !== "ceo") return { error: "Only the CEO can create announcements" };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid announcement." };
  }

  const { error } = await supabase.from("announcements").insert({
    title: parsed.data.title,
    body: parsed.data.body,
    status: "draft",
    author_id: user.user.id,
    expires_at: parsed.data.expires_at || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/announcements");
  return { success: true };
}

export async function publishAnnouncement(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (role !== "ceo") return { error: "Only the CEO can publish announcements" };

  const announcementId = formData.get("announcement_id") as string;
  const { error } = await supabase
    .from("announcements")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", announcementId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/announcements");
  return { success: true };
}

export async function expireAnnouncement(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (role !== "ceo") return { error: "Only the CEO can expire announcements" };

  const announcementId = formData.get("announcement_id") as string;
  const { error } = await supabase.from("announcements").update({ status: "expired" }).eq("id", announcementId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/announcements");
  return { success: true };
}

export async function archiveAnnouncement(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (role !== "ceo") return { error: "Only the CEO can archive announcements" };

  const announcementId = formData.get("announcement_id") as string;
  const { error } = await supabase.from("announcements").update({ status: "archived" }).eq("id", announcementId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/announcements");
  return { success: true };
}
