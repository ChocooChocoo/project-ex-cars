"use client";

import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { revalidatePath } from "@/lib/api/revalidate";
import { contentItemSchema } from "@/lib/validation/vehicles";
import { isVehicleMediaKind } from "@/lib/vehicles/media-kinds";

// Phase 4b: the Laravel-backed vehicle actions (showroom media, favourites, content) run in the browser.
// The Supabase-backed ones stay in ./actions.ts until Phase 5 moves them.

async function apiGet<T>(path: string) {
  return { data: await browserApi<T>("GET", path) };
}
async function apiWrite<T = unknown>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  return { data: await browserApi<T>(method, path, body) };
}

export async function uploadVehicleMedia(formData: FormData) {
  const vehicleId = formData.get("vehicle_id") as string;
  const mediaKind = formData.get("media_kind") as string;
  const file = formData.get("file") as File | null;

  if (!vehicleId || !file || file.size === 0) return { error: "Vehicle and file are required" };
  if (!isVehicleMediaKind(mediaKind)) return { error: "Invalid media kind" };

  // Laravel checks the role (Marketing Specialist), sniffs the file type, enforces the 2 MB cap and picks the path.
  const upload = new FormData();
  upload.set("media_kind", mediaKind);
  upload.set("file", file);
  try {
    await apiWrite("POST", `/api/v1/staff/vehicles/${encodeURIComponent(vehicleId)}/media`, upload);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath(`/dashboard/vehicles/${vehicleId}`);
  return { success: true };
}

export async function deleteVehicleMedia(mediaId: string) {
  let vehicleId: string;
  try {
    ({ vehicle_id: vehicleId } = (
      await apiWrite<{ vehicle_id: string }>("DELETE", `/api/v1/staff/vehicle-media/${encodeURIComponent(mediaId)}`)
    ).data);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath("/dashboard/vehicles");
  revalidatePath(`/dashboard/vehicles/${vehicleId}`);
  return { success: true };
}

export async function toggleFavourite(vehicleId: string) {
  try {
    const { data } = await apiWrite<{ favourited: boolean }>(
      "POST",
      `/api/v1/favourites/${encodeURIComponent(vehicleId)}`,
    );
    return { success: true, favourited: data.favourited };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function getFavourites(): Promise<Record<string, unknown>[]> {
  // T11: Laravel strips GCE's private vehicle fields (identifiers, financing markup) from this customer list.
  try {
    return (await apiGet<Record<string, unknown>[]>("/api/v1/favourites")).data;
  } catch {
    return [];
  }
}

export async function createContentItem(formData: FormData) {
  const parsed = contentItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid content item." };
  }
  try {
    await apiWrite("POST", "/api/v1/staff/content", parsed.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath("/content");
  return { success: true };
}

export async function publishContent(id: string) {
  try {
    await apiWrite("POST", `/api/v1/staff/content/${encodeURIComponent(id)}/publish`);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath("/content");
  return { success: true };
}

export async function updateContentItem(formData: FormData) {
  const id = formData.get("id") as string;
  const parsed = contentItemSchema.safeParse(Object.fromEntries(formData));
  if (!id) return { error: "Content item not found." };
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid content item." };
  }
  try {
    await apiWrite("PATCH", `/api/v1/staff/content/${encodeURIComponent(id)}`, parsed.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath("/content");
  return { success: true };
}

export async function deleteContentItem(id: string) {
  try {
    await apiWrite("DELETE", `/api/v1/staff/content/${encodeURIComponent(id)}`);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath("/content");
  return { success: true };
}
