"use client";

import { getInquiryThread, markMessagesRead, sendMessageWithAttachment } from "@/app/(customer)/my-inquiries/actions";
import { InquiryConversation } from "@/components/inquiries/inquiry-conversation";
import { usePageData } from "@/lib/api/use-page-data";

/**
 * Notes line 62: the chat on a supplier post. The supplier sees it from the "customer" side; the Marketing
 * Specialist writes from the staff side; the CEO and the Confidential Informant only read it.
 */
export function SupplierPostChat({
  threadId,
  perspective,
  readOnly = false,
}: {
  readonly threadId: string;
  readonly perspective: "customer" | "staff";
  readonly readOnly?: boolean;
}) {
  const thread = usePageData(`supplier-thread:${threadId}`, () => getInquiryThread(threadId));
  if (thread.loading && !thread.data) return <p className="text-muted-foreground text-sm">Loading the conversation…</p>;
  if (!thread.data?.ok) {
    return <p className="text-muted-foreground text-sm">The conversation could not be loaded.</p>;
  }
  const { inquiry, messages, arrangement } = thread.data.data;
  return (
    <div className="h-[28rem]">
      <InquiryConversation
        key={threadId}
        inquiry={inquiry}
        messages={messages}
        arrangement={arrangement}
        perspective={perspective}
        sendMessage={sendMessageWithAttachment}
        markMessagesRead={markMessagesRead}
        readOnly={readOnly}
        fillHeight
      />
    </div>
  );
}
