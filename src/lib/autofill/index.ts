import { getSession } from "@/lib/auth/session";

export interface ProfileAutoFill {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** T10: the PSGC parts, so the Buying address picker starts from the profile. */
  address_line: string | null;
  region_code: string | null;
  province_code: string | null;
  city_code: string | null;
  barangay_code: string | null;
}

export async function getProfileAutoFill(): Promise<ProfileAutoFill | null> {
  const me = await getSession().catch(() => null);
  if (!me) return null;

  const { profile } = me;
  return {
    full_name: profile.full_name,
    email: me.email,
    phone: profile.phone,
    address: profile.address,
    address_line: profile.address_line,
    region_code: profile.region_code,
    province_code: profile.province_code,
    city_code: profile.city_code,
    barangay_code: profile.barangay_code,
  };
}
