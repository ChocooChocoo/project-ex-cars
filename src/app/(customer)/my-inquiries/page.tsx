"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import { InquiryChat } from "./_components/inquiry-chat";

export default function InquiriesPage() {
  // The customer's own threads, newest first, with unread counts (Laravel scopes them to the session user).
  const page = usePageData("my-inquiries", () =>
    browserApi<{ inquiries: Record<string, unknown>[]; unread_by_inquiry: Record<string, number> }>(
      "GET",
      "/api/v1/inquiries",
    ),
  );
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;

  return (
    <div data-content-padding="false" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <InquiryChat inquiries={page.data.inquiries} unreadByInquiry={page.data.unread_by_inquiry} />
    </div>
  );
}
