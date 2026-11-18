"use client";

import { useRequireRole, useSession } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import { StaffInquiryChat } from "./_components/staff-inquiry-chat";

export default function StaffInquiriesPage() {
  const me = useSession();
  const myRole = me.role ?? "";
  const allowed = useRequireRole(["ceo", "account_manager", "sales_manager"]);

  // Laravel scopes the inbox by role: the Sales Manager sees buy threads; the CEO and Account Manager see all
  // but sell negotiations, which the Marketing Specialist opens from the sell offer.
  const page = usePageData(allowed ? "staff-inquiries" : "staff-inquiries:denied", () =>
    allowed
      ? browserApi<{ inquiries: Record<string, unknown>[]; unread_by_inquiry: Record<string, number> }>(
          "GET",
          "/api/v1/inquiries",
        )
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const list = page.data.inquiries;
  const unreadByInquiry = page.data.unread_by_inquiry;

  return (
    <div data-content-padding="false" className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
      <InquiriesInboxStrip inquiries={list} unreadByInquiry={unreadByInquiry} />
      <StaffInquiryChat inquiries={list} unreadByInquiry={unreadByInquiry} userRole={myRole} currentUserId={me.id} />
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
