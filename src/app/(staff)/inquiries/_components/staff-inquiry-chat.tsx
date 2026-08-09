"use client";

import { InquiryChatShell } from "@/components/inquiries/inquiry-chat-shell";

import { getStaffInquiryThread } from "../actions";
import { StaffChatView } from "./staff-chat-view";

interface StaffInquiryChatProps {
  readonly inquiries: Record<string, unknown>[];
  readonly unreadByInquiry?: Record<string, number>;
  readonly userRole: string;
}

export function StaffInquiryChat({ inquiries, unreadByInquiry = {}, userRole }: StaffInquiryChatProps) {
  return (
    <InquiryChatShell
      title="Inquiries Queue"
      inquiries={inquiries}
      unreadByInquiry={unreadByInquiry}
      emptyMessage="No inquiries yet. Conversations appear here once started."
      loadThread={getStaffInquiryThread}
      renderThread={(thread, onBack) => (
        <StaffChatView
          key={thread.inquiry.id as string}
          inquiry={thread.inquiry}
          messages={thread.messages}
          arrangement={thread.arrangement}
          userRole={userRole}
          fillHeight
          onBack={onBack}
        />
      )}
    />
  );
}
