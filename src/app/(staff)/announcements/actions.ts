"use client";

import { apiAction } from "@/lib/api/action";
import { announcementSchema } from "@/lib/validation/phase6";

// Phase 7: browser adapters for the Laravel announcement endpoints (AnnouncementController, CEO only).

type Phase6ActionResult = { error: string } | { success: true };

async function done(path: string, body: unknown): Promise<Phase6ActionResult> {
  const result = await apiAction(path, body);
  return result.error !== undefined ? { error: result.error } : { success: true };
}

export async function createAnnouncement(formData: FormData): Promise<Phase6ActionResult> {
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid announcement." };
  return done("/staff/announcements", { ...parsed.data, expires_at: parsed.data.expires_at || null });
}

const setStatus = (status: "published" | "expired" | "archived") => (formData: FormData) =>
  done(`/staff/announcements/${status}`, { announcement_id: formData.get("announcement_id") });

export const publishAnnouncement = setStatus("published");
export const expireAnnouncement = setStatus("expired");
export const archiveAnnouncement = setStatus("archived");
