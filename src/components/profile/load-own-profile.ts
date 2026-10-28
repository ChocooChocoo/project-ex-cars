import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { type GceRole, ROLE_LABELS } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

import type { OwnProfile } from "./profile-forms";

/** The signed-in user's own profile, for the profile page of any role. */
export async function loadOwnProfile(): Promise<OwnProfile> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const [{ data: profile }, role] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, address, avatar_url").eq("id", user.id).maybeSingle(),
    getCurrentRole(),
  ]);

  return {
    email: user.email ?? "",
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    avatar_url: profile?.avatar_url ?? null,
    role_label: role ? (ROLE_LABELS[role as GceRole] ?? null) : null,
  };
}
