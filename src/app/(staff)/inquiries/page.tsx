import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase/server";

import { StaffInquiryChat } from "./_components/staff-inquiry-chat";

export default async function StaffInquiriesPage() {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: roleRow } = await supabase.rpc("get_user_roles");
  const roles = (roleRow as { account_id: string; role: string }[] | null) ?? [];
  const myRole = roles.find((r) => r.account_id === user.user.id)?.role ?? "";
  if (!["ceo", "account_manager", "sales_manager"].includes(myRole)) {
    redirect("/unauthorized");
  }

  let query = supabase.from("inquiries").select("*, vehicles(make, model, year), profiles(full_name)");

  if (myRole === "sales_manager") {
    query = query.eq("intention_kind", "buy_now");
  }

  const { data: inquiries } = await query.order("updated_at", { ascending: false });
  const list = (inquiries as Record<string, unknown>[]) ?? [];
  const ids = list.map((inquiry) => inquiry.id as string);

  let unreadByInquiry: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: unreadRows } = await supabase
      .from("inquiry_messages")
      .select("inquiry_id")
      .in("inquiry_id", ids)
      .neq("sender_id", user.user.id)
      .is("read_at", null);

    unreadByInquiry = {};
    for (const row of unreadRows ?? []) {
      const inquiryId = row.inquiry_id as string;
      unreadByInquiry[inquiryId] = (unreadByInquiry[inquiryId] ?? 0) + 1;
    }
  }

  return (
    <div data-content-padding="false" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <StaffInquiryChat inquiries={list} unreadByInquiry={unreadByInquiry} userRole={myRole} />
    </div>
  );
}
