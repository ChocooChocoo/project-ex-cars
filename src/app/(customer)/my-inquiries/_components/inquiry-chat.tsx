"use client";

import { InquiryChatShell } from "@/components/inquiries/inquiry-chat-shell";

import { getInquiryThread } from "../actions";
import { ChatView } from "./chat-view";

interface InquiryChatProps {
  readonly inquiries: Record<string, unknown>[];
  readonly unreadByInquiry?: Record<string, number>;
}

export function InquiryChat({ inquiries, unreadByInquiry = {} }: InquiryChatProps) {
  return (
    <InquiryChatShell
      title="My Inquiries"
      inquiries={inquiries}
      unreadByInquiry={unreadByInquiry}
      emptyMessage="No conversations yet. Browse the showroom to start one."
      loadThread={getInquiryThread}
      renderThread={(thread, onBack) => (
        <ChatView
          key={thread.inquiry.id as string}
          inquiry={thread.inquiry}
          messages={thread.messages}
          arrangement={thread.arrangement}
          fillHeight
          onBack={onBack}
        />
      )}
    />
  );
}
