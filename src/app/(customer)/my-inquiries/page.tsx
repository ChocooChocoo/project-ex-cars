import { createServerSupabase } from "@/lib/supabase/server";

import { InquiryChat } from "./_components/inquiry-chat";

export default async function InquiriesPage() {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("*, vehicles(make, model, year)")
    .eq("customer_id", user.user.id)
    .order("updated_at", { ascending: false });

  const list = (inquiries as Record<string, unknown>[]) ?? [];
  const ids = list.map((inq) => inq.id as string);

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
      <InquiryChat inquiries={list} unreadByInquiry={unreadByInquiry} />
    </div>
  );
}
