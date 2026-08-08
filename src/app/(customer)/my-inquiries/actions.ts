"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabase } from "@/lib/supabase/server";

export async function createInquiry(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const vehicleId = formData.get("vehicle_id") as string;
  const intentionKind = (formData.get("intention_kind") as string) || "inquiry";

  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .insert({
      customer_id: user.user.id,
      vehicle_id: vehicleId,
      intention_kind: intentionKind,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/inquiries");
  revalidatePath("/dashboard/inquiries");
  return { success: true, id: inquiry.id };
}

export async function sendMessage(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const inquiryId = formData.get("inquiry_id") as string;
  const text = formData.get("message_text") as string;

  if (!text?.trim()) return { error: "Message cannot be empty" };

  const { error } = await supabase.from("inquiry_messages").insert({
    inquiry_id: inquiryId,
    sender_id: user.user.id,
    message_text: text,
  });

  if (error) return { error: error.message };

  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  return { success: true };
}

export async function assignInquiry(inquiryId: string, role: "account_manager" | "sales_manager") {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const update: Record<string, string> = {};
  if (role === "account_manager") update.assigned_account_manager = user.user.id;
  else update.assigned_sales_manager = user.user.id;

  const { error } = await supabase.from("inquiries").update(update).eq("id", inquiryId);

  if (error) return { error: error.message };

  await supabase.from("inquiries").update({ state: "assigned" }).eq("id", inquiryId).eq("state", "open");

  revalidatePath("/dashboard/inquiries");
  return { success: true };
}

export async function scheduleArrangement(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const inquiryId = formData.get("inquiry_id") as string;
  const kind = formData.get("arrangement_kind") as string;
  const schedule = formData.get("schedule") as string;
  const location = formData.get("location") as string;
  const notes = formData.get("notes") as string | null;

  const { error } = await supabase.from("viewing_arrangements").insert({
    inquiry_id: inquiryId,
    arrangement_kind: kind,
    schedule: new Date(schedule).toISOString(),
    location: location || null,
    notes,
  });

  if (error) return { error: error.message };

  await supabase.from("inquiries").update({ state: "scheduled" }).eq("id", inquiryId);

  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  return { success: true };
}

export async function handoffInquiry(inquiryId: string) {
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("inquiries")
    .update({ handoff_state: "handed_off", state: "handed_off" })
    .eq("id", inquiryId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  return { success: true };
}

export async function markMessagesRead(inquiryId: string) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  await supabase
    .from("inquiry_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("inquiry_id", inquiryId)
    .neq("sender_id", user.user.id)
    .is("read_at", null);

  revalidatePath("/inquiries");
  revalidatePath("/dashboard/inquiries");
}

export async function reportMessage(inquiryId: string, messageId: string, reason: string) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { error } = await supabase.from("message_reports").insert({
    reported_message_id: messageId || null,
    reported_inquiry_id: inquiryId,
    reporter_id: user.user.id,
    reason,
  });

  if (error) return { error: error.message };

  return { success: true };
}

export async function reviewReport(reportId: string, decision: string) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

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
