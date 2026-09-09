import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <div data-content-padding="false" className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
      <InquiriesInboxStrip inquiries={list} unreadByInquiry={unreadByInquiry} />
      <StaffInquiryChat
        inquiries={list}
        unreadByInquiry={unreadByInquiry}
        userRole={myRole}
        currentUserId={user.user.id}
      />
    </div>
  );
}

export function getInquiriesSummary(inquiries: Record<string, unknown>[], unreadByInquiry: Record<string, number>) {
  const total = inquiries.length;
  const unread = Object.values(unreadByInquiry).reduce((sum, count) => sum + count, 0);
  const unreadInquiries = inquiries.filter((item) => (unreadByInquiry[item.id as string] ?? 0) > 0).length;
  const needsReply = unreadInquiries;
  const open = inquiries.filter((item) => item.state === "open" || item.state === "assigned").length;
  return { total, unread, unreadInquiries, needsReply, open };
}

function InquiriesInboxStrip({
  inquiries,
  unreadByInquiry,
}: {
  readonly inquiries: Record<string, unknown>[];
  readonly unreadByInquiry: Record<string, number>;
}) {
  const summary = getInquiriesSummary(inquiries, unreadByInquiry);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="inquiries-inbox-strip">
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Total Inquiries</span>
          <span className="font-semibold text-2xl">{summary.total}</span>
          <Badge variant="secondary" className="w-fit">
            {summary.open} open
          </Badge>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Unread</span>
          <span className="font-semibold text-2xl">{summary.unread}</span>
          <Badge variant="outline" className="w-fit">
            {summary.unreadInquiries} threads
          </Badge>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Needs Reply</span>
          <span className="font-semibold text-2xl">{summary.needsReply}</span>
          <Badge variant={summary.needsReply > 0 ? "default" : "secondary"} className="w-fit">
            awaiting staff
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
