import { createServerSupabase } from "@/lib/supabase/server";

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
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, address, address_line, region_code, province_code, city_code, barangay_code")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    full_name: profile.full_name,
    email: user.email ?? null,
    phone: profile.phone,
    address: profile.address,
    address_line: profile.address_line,
    region_code: profile.region_code,
    province_code: profile.province_code,
    city_code: profile.city_code,
    barangay_code: profile.barangay_code,
  };
}
