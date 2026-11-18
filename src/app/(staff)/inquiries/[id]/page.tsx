import { notFound } from "next/navigation";

import { loadThread } from "@/app/(customer)/my-inquiries/actions";
import { getCurrentRole } from "@/app/auth/actions";

import { StaffChatView } from "../_components/staff-chat-view";

export default async function StaffChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager", "sales_manager", "marketing_specialist"].includes(role)) notFound();

  // Laravel's InquiryPolicy: the Sales Manager reads buy threads, and (T01 Selling step 5) the Marketing
  // Specialist only the offer's own sell_negotiation thread. Anything else is a 404.
  const thread = await loadThread(id);
  if (!thread.ok) notFound();

  return (
    <StaffChatView
      inquiry={thread.data.inquiry}
      messages={thread.data.messages}
      arrangement={thread.data.arrangement}
      userRole={role}
    />
  );
}
