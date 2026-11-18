import { apiGet } from "@/lib/api/server";

import { InquiryChat } from "./_components/inquiry-chat";

export default async function InquiriesPage() {
  // The customer's own threads, newest first, with unread counts (Laravel scopes them to the session user).
  const { data } = await apiGet<{ inquiries: Record<string, unknown>[]; unread_by_inquiry: Record<string, number> }>(
    "/api/v1/inquiries",
  );

  return (
    <div data-content-padding="false" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <InquiryChat inquiries={data.inquiries} unreadByInquiry={data.unread_by_inquiry} />
    </div>
  );
}
