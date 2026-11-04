"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// T06: Skip and Finish both end the tutorial for good.
export async function completeTutorial() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ tutorial_completed_at: new Date().toISOString() })
    .eq("id", data.user.id);
  return error ? { error: error.message } : { success: true };
}

export async function needsTutorial(): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("tutorial_completed_at")
    .eq("id", data.user.id)
    .maybeSingle();
  return profile !== null && !profile.tutorial_completed_at;
}
