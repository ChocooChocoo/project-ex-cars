"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/action-guard";
import { getProfileAutoFill } from "@/lib/autofill";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createInquirySchema, scheduleArrangementSchema } from "@/lib/validation/inquiries";

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
