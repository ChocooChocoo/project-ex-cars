import { redirect } from "next/navigation";

import { type GceRole, ROLE_LABELS } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";

import type { OwnProfile } from "./profile-forms";

/** The signed-in user's own profile, for the profile page of any role. */
export async function loadOwnProfile(): Promise<OwnProfile> {
  const me = await getSession();
  if (!me) redirect("/auth/v1/login");

  const { profile, role } = me;
  return {
    email: me.email,
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    address_line: profile.address_line ?? "",
    region_code: profile.region_code ?? "",
    province_code: profile.province_code ?? "",
    city_code: profile.city_code ?? "",
    barangay_code: profile.barangay_code ?? "",
    avatar_url: profile.avatar_url ?? null,
    role_label: role ? (ROLE_LABELS[role as GceRole] ?? null) : null,
    can_change_email: role === "customer",
  };
}
