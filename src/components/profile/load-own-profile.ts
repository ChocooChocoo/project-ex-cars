import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase/server";

import type { OwnProfile } from "./profile-forms";

/** The signed-in user's own profile, for the profile page of any role. */
export async function loadOwnProfile(): Promise<OwnProfile> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, address")
    .eq("id", user.id)
    .maybeSingle();

  return {
    email: user.email ?? "",
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
  };
}
