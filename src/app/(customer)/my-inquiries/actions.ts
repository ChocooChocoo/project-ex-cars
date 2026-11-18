"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import type { InquiryRecord, InquiryThreadData } from "@/components/inquiries/types";
import { ApiError, errorMessage as apiErrorMessage } from "@/lib/api/errors";
import { apiGet, apiWrite } from "@/lib/api/server";
import { authorizeAction } from "@/lib/auth/action-guard";
import { type ActionResult, failure, notAuthenticated, notFound } from "@/lib/auth/action-result";
import { getProfileAutoFill } from "@/lib/autofill";
import { attachmentError, attachmentMimeType, type SignedAttachment } from "@/lib/inquiries/attachments";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createInquirySchema, scheduleArrangementSchema, sendMessageSchema } from "@/lib/validation/inquiries";

export async function createInquiry(formData: FormData) {
  const authorization = await authorizeAction(["customer"]);
  if (!authorization.ok) return { error: authorization.message };
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = createInquirySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid inquiry." };
  }

  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .insert({
      customer_id: user.user.id,
      vehicle_id: parsed.data.vehicle_id,
      intention_kind: parsed.data.intention_kind || "inquiry",
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/inquiries");
  revalidatePath("/dashboard/inquiries");
  return { success: true, id: inquiry.id };
}

export async function getInquiryThread(inquiryId: string): Promise<ActionResult<InquiryThreadData>> {
  return loadThread(inquiryId);
}

// T03 C16: the message, with its file when there is one, in one multipart request. Laravel stores the
// file under the thread's folder (it picks the name), checks type and size, and signs the link it returns.
export async function sendMessageWithAttachment(
  formData: FormData,
): Promise<{ error: string } | { success: true; message: InquiryRecord; attachment: SignedAttachment | null }> {
  const parsed = sendMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }
  const inquiryId = parsed.data.inquiry_id;
  const text = parsed.data.message_text || "";
  const file = formData.get("attachment");
  const hasFile = file instanceof File && file.size > 0;
  if (!text.trim() && !hasFile) return { error: "Message cannot be empty" };
  if (hasFile) {
    const fileError = attachmentError({ name: file.name, type: attachmentMimeType(file), size: file.size });
    if (fileError) return { error: fileError };
  }

  const body = new FormData();
  body.set("message_text", text);
  if (hasFile) body.set("attachment", file);
  try {
    const { data } = await apiWrite<{ message: InquiryRecord; attachment: SignedAttachment | null }>(
      "POST",
      `/api/v1/inquiries/${encodeURIComponent(inquiryId)}/messages`,
      body,
    );
    revalidatePath(`/inquiries/${inquiryId}`);
    revalidatePath(`/dashboard/inquiries/${inquiryId}`);
    return { success: true, message: data.message, attachment: data.attachment };
  } catch (error) {
    return { error: apiErrorMessage(error) };
  }
}

export async function sendMessage(formData: FormData) {
  const parsed = sendMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }
  const inquiryId = parsed.data.inquiry_id;
  const text = parsed.data.message_text || "";
  if (!text?.trim()) return { error: "Message cannot be empty" };

  try {
    await apiWrite("POST", `/api/v1/inquiries/${encodeURIComponent(inquiryId)}/messages`, { message_text: text });
  } catch (error) {
    return { error: apiErrorMessage(error) };
  }
  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  return { success: true };
}

export async function assignInquiry(inquiryId: string, role: "account_manager" | "sales_manager") {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  // Only account_manager or sales_manager may assign themselves to an inquiry.
  if (role === "account_manager") {
    const { data: roles } = await supabase.rpc("get_user_roles");
    const hasRole = (roles as { role: string }[] | undefined)?.some((r) => r.role === "account_manager");
    if (!hasRole) return { error: "Not authorized" };
  } else if (role === "sales_manager") {
    const { data: roles } = await supabase.rpc("get_user_roles");
    const hasRole = (roles as { role: string }[] | undefined)?.some((r) => r.role === "sales_manager");
    if (!hasRole) return { error: "Not authorized" };
  }

  const update: Record<string, string> = {};
  if (role === "account_manager") update.assigned_account_manager = user.user.id;
  else update.assigned_sales_manager = user.user.id;

  const { error } = await supabase.from("inquiries").update(update).eq("id", inquiryId);

  if (error) return { error: error.message };

  await supabase.from("inquiries").update({ state: "assigned" }).eq("id", inquiryId).eq("state", "open");

  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath("/inquiries");
  return { success: true };
}

export async function scheduleArrangement(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) =>
    ["account_manager", "sales_manager"].includes(r.role),
  );
  if (!hasRole) return { error: "Not authorized" };

  const parsed = scheduleArrangementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid arrangement." };
  }

  const inquiryId = parsed.data.inquiry_id;
  const kind = parsed.data.arrangement_kind;
  const schedule = parsed.data.schedule;
  const location = parsed.data.location || null;
  const notes = parsed.data.notes || null;

  // Autofill location from the customer's profile if not provided.
  let resolvedLocation = location;
  if (!resolvedLocation) {
    const { data: inquiryRow } = await supabase.from("inquiries").select("customer_id").eq("id", inquiryId).single();
    if (inquiryRow?.customer_id) {
      const { data: customerProfile } = await supabase
        .from("profiles")
        .select("address")
        .eq("id", inquiryRow.customer_id as string)
        .single();
      resolvedLocation = (customerProfile?.address as string | null) ?? null;
    }
    if (!resolvedLocation) {
      const autofill = await getProfileAutoFill();
      resolvedLocation = autofill?.address ?? null;
    }
  }

  const { error } = await supabase.from("viewing_arrangements").insert({
    inquiry_id: inquiryId,
    arrangement_kind: kind,
    schedule: new Date(schedule).toISOString(),
    location: resolvedLocation,
    notes,
  });

  if (error) return { error: error.message };

  await supabase.from("inquiries").update({ state: "scheduled" }).eq("id", inquiryId);

  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  return { success: true, location: resolvedLocation };
}

export async function handoffInquiry(inquiryId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["account_manager"].includes(r.role));
  if (!hasRole) return { error: "Only the Account Manager can request a handoff." };

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("state, handoff_state")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!inquiry) return { error: "Inquiry not found." };
  if (inquiry.state !== "scheduled") {
    return { error: "A viewing must be scheduled before handing off." };
  }
  if (inquiry.handoff_state === "pending_handoff") {
    return { error: "A handoff is already pending acceptance." };
  }
  if (inquiry.handoff_state === "handed_off") {
    return { error: "This inquiry has already been handed off." };
  }

  const { error } = await supabase.from("inquiries").update({ handoff_state: "pending_handoff" }).eq("id", inquiryId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  return { success: true };
}

export async function acceptHandoff(inquiryId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["sales_manager"].includes(r.role));
  if (!hasRole) return { error: "Only the Sales Manager can accept a handoff." };

  const { data: inquiry } = await supabase.from("inquiries").select("handoff_state").eq("id", inquiryId).maybeSingle();
  if (!inquiry) return { error: "Inquiry not found." };
  if (inquiry.handoff_state !== "pending_handoff") {
    return { error: "There is no pending handoff to accept." };
  }

  const { error } = await supabase
    .from("inquiries")
    .update({
      handoff_state: "handed_off",
      state: "handed_off",
      assigned_sales_manager: user.user.id,
    })
    .eq("id", inquiryId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  return { success: true };
}

export async function markMessagesRead(inquiryId: string) {
  let marked = 0;
  try {
    ({ marked } = (
      await apiWrite<{ marked: number }>("POST", `/api/v1/inquiries/${encodeURIComponent(inquiryId)}/read`)
    ).data);
  } catch {
    return;
  }
  // Revalidating refreshes the open page; doing it when nothing changed re-mounts the thread and loops.
  if (marked > 0) {
    revalidatePath("/inquiries");
    revalidatePath("/dashboard/inquiries");
  }
}

export async function getUnreadCount(inquiryId: string): Promise<number> {
  try {
    const { data } = await apiGet<{ unread_by_inquiry: Record<string, number> }>("/api/v1/inquiries");
    return data.unread_by_inquiry[inquiryId] ?? 0;
  } catch {
    return 0;
  }
}

// Awaited during the staff layout render for the sidebar badge: a GET only, so it never writes cookies.
export async function getTotalUnreadCount(): Promise<number> {
  try {
    return (await apiGet<{ count: number }>("/api/v1/inquiries/unread-count")).data.count;
  } catch {
    return 0;
  }
}

export async function reportMessage(inquiryId: string, messageId: string, reason: string) {
  try {
    await apiWrite("POST", `/api/v1/inquiries/${encodeURIComponent(inquiryId)}/reports`, {
      message_id: messageId || null,
      reason,
    });
  } catch (error) {
    return { error: apiErrorMessage(error) };
  }
  return { success: true };
}

export async function reviewReport(reportId: string, decision: string) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["ceo", "account_manager"].includes(r.role));
  if (!hasRole) return { error: "Not authorized" };

  const { error } = await supabase
    .from("message_reports")
    .update({
      state: decision === "dismiss" ? "dismissed" : "upheld",
      reviewer_id: user.user.id,
      decision_date: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/inquiries/reports");
  return { success: true };
}

/** One thread for whoever is signed in; Laravel applies InquiryPolicy (another customer's thread is a 404). */
export async function loadThread(inquiryId: string): Promise<ActionResult<InquiryThreadData>> {
  if (!z.string().uuid().safeParse(inquiryId).success) return failure("validation_error", "Invalid inquiry.");
  try {
    const { data } = await apiGet<InquiryThreadData>(`/api/v1/inquiries/${encodeURIComponent(inquiryId)}`);
    return { ok: true, data: { inquiry: data.inquiry, messages: data.messages, arrangement: data.arrangement } };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return notFound("Inquiry");
    if (error instanceof ApiError && error.status === 401) return notAuthenticated();
    return failure("load_failed", "Could not load this conversation.");
  }
}
