import type { Me } from "@/lib/api/types";
import { type GceRole, ROLE_LABELS } from "@/lib/auth/roles";

import type { OwnProfile } from "./profile-forms";

/** The signed-in user's own profile (from the session), for the profile page of any role. */
export function toOwnProfile(me: Me): OwnProfile {
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
