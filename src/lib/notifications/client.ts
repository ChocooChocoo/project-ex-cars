"use client";

import { browserApi } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { revalidatePath } from "@/lib/api/revalidate";

import { type NotificationPage, type NotificationRow, withHrefs } from "./with-hrefs";

export type { NotificationRow } from "./with-hrefs";

// Phase 4b: browser module. The installment and review jobs stay in ./actions.ts until Phase 6 moves them
// to the Laravel scheduler.

async function apiGet<T>(path: string) {
  return { data: await browserApi<T>("GET", path) };
}
async function apiWrite<T = unknown>(method: "POST", path: string) {
  return { data: await browserApi<T>(method, path) };
}

// Rows for the caller's role plus rows addressed to them; Laravel derives both from the session, so `_role`
// is kept only for the existing call sites. Awaited during layout renders: a GET only, never a cookie write.
export async function getNotifications(_role: string): Promise<NotificationRow[]> {
  try {
    return withHrefs((await apiGet<NotificationPage>("/api/v1/notifications")).data);
  } catch {
    return [];
  }
}

export async function getUnreadNotificationCount(_role: string): Promise<number> {
  try {
    return (await apiGet<{ count: number }>("/api/v1/notifications/count")).data.count;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    await apiWrite("POST", `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { error: "Notification not found." };
    return { error: errorMessage(error) };
  }
  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAllNotificationsRead() {
  try {
    await apiWrite("POST", "/api/v1/notifications/read-all");
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/dashboard");
  return { success: true };
}
