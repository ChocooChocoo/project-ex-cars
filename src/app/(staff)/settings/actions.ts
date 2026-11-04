"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { type GceRole, SETTINGS_MANAGER_ROLES } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const markupSchema = z.coerce
  .number({ error: "Enter a percentage." })
  .min(0, "The profit cannot be negative.")
  .max(100, "The profit cannot exceed 100%.");

// T06: the CEO (and the Super Admin) adjust GCE's financing profit. RLS on `app_settings` enforces the
// same roles; the user client is used for the write so a bypass of this check still fails.
export async function updateFinancingMarkup(value: unknown) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  if (!role || !SETTINGS_MANAGER_ROLES.includes(role as GceRole)) return { error: "Not authorized" };

  const parsed = markupSchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid percentage." };
  const pct = Math.round(parsed.data * 100) / 100;

  const { data: updated, error } = await supabase
    .from("app_settings")
    .update({ value: pct, updated_by: user.user.id, updated_at: new Date().toISOString() })
    .eq("key", "financing_markup_pct")
    .select("id");
  if (error || !updated?.length) return { error: error?.message ?? "The setting could not be saved." };

  await createAdminClient()
    .from("audit_events")
    .insert({
      actor_id: user.user.id,
      action: "financing_markup_updated",
      record_kind: "app_setting",
      record_id: updated[0].id,
      summary: `Financing profit set to ${pct}%`,
    });

  revalidatePath("/", "layout");
  return { success: true, pct };
}
