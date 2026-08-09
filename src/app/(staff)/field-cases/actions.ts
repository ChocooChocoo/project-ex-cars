"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fieldCaseUpdateSchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const FIELD_CASE_WORKERS = ["ceo", "confidential_informant", "mechanic", "sales_manager"];

export async function updateFieldCase(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !FIELD_CASE_WORKERS.includes(role)) {
    return { error: "Not authorized to update field cases" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = fieldCaseUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid field case update." };
  }

  const update: Record<string, unknown> = {
    state: parsed.data.state,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.state === "completed") {
    update.completion_date = new Date().toISOString();
  }
  if (parsed.data.state === "accepted" && !raw.accepted_at) {
    update.accepted_at = new Date().toISOString();
  }
  if (parsed.data.expenses_cents !== undefined) {
    update.expenses_cents = parsed.data.expenses_cents;
  }
  if (parsed.data.notes !== undefined) {
    update.notes = parsed.data.notes || null;
  }

  const { error } = await supabase.from("field_cases").update(update).eq("id", parsed.data.field_case_id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/field-cases");
  return { success: true };
}
