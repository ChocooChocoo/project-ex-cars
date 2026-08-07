import { createServerSupabase } from "@/lib/supabase/server";

export interface ProfileAutoFill {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export async function getProfileAutoFill(): Promise<ProfileAutoFill | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, address")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    full_name: profile.full_name,
    email: user.email ?? null,
    phone: profile.phone,
    address: profile.address,
  };
}
