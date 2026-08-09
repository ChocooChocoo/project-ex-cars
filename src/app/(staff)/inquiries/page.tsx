import { createServerSupabase } from "@/lib/supabase/server";

import { StaffInquiryChat } from "./_components/staff-inquiry-chat";

export default async function StaffInquiriesPage() {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: roleRow } = await supabase.rpc("get_user_roles");
  const roles = (roleRow as { account_id: string; role: string }[] | null) ?? [];
  const myRole = roles.find((r) => r.account_id === user.user.id)?.role ?? "";

  let query = supabase.from("inquiries").select("*, vehicles(make, model, year)");

  if (myRole === "sales_manager") {
    query = query.eq("intention_kind", "buy_now");
  }

  const { data: inquiries } = await query.order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <StaffInquiryChat inquiries={(inquiries as Record<string, unknown>[]) ?? []} userRole={myRole} />
    </div>
  );
}
