"use server";

import { revalidatePath } from "next/cache";

import { getProfileAutoFill } from "@/lib/autofill";
import { createServerSupabase } from "@/lib/supabase/server";
import { createInquirySchema, scheduleArrangementSchema, sendMessageSchema } from "@/lib/validation/inquiries";

export async function createInquiry(formData: FormData) {
  const supabase = await createServerSupabase();
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

export async function sendMessageWithAttachment(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = sendMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }

  const inquiryId = parsed.data.inquiry_id;
  const text = parsed.data.message_text || "";
  const file = formData.get("file") as File | null;

  if (!text?.trim() && !file) return { error: "Message cannot be empty" };

  const { data: message, error } = await supabase
    .from("inquiry_messages")
    .insert({
      inquiry_id: inquiryId,
      sender_id: user.user.id,
      message_text: text || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop() ?? "bin";
    const storagePath = `${inquiryId}/${message.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from("message-attachments").upload(storagePath, file);

    if (!uploadError) {
      await supabase.from("message_attachments").insert({
        message_id: message.id,
        storage_path: storagePath,
        original_name: file.name,
        mime_type: file.type || null,
      });
    }
  }

  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  return { success: true };
}

export async function sendMessage(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = sendMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }

  const inquiryId = parsed.data.inquiry_id;
  const text = parsed.data.message_text || "";

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

  revalidatePath("/dashboard/inquiries");
  return { success: true };
}

export async function scheduleArrangement(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) =>
    ["ceo", "account_manager", "sales_manager"].includes(r.role),
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
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) =>
    ["ceo", "account_manager", "sales_manager"].includes(r.role),
  );
  if (!hasRole) return { error: "Not authorized" };

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

export async function getUnreadCount(inquiryId: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return 0;

  const { count } = await supabase
    .from("inquiry_messages")
    .select("*", { count: "exact", head: true })
    .eq("inquiry_id", inquiryId)
    .neq("sender_id", user.user.id)
    .is("read_at", null);

  return count ?? 0;
}

export async function getTotalUnreadCount(): Promise<number> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return 0;

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) =>
    ["ceo", "account_manager", "sales_manager"].includes(r.role),
  );
  if (!hasRole) return 0;

  const { count } = await supabase
    .from("inquiry_messages")
    .select("*", { count: "exact", head: true })
    .neq("sender_id", user.user.id)
    .is("read_at", null);

  return count ?? 0;
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
