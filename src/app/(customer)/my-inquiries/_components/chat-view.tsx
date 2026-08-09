"use client";

import { InquiryConversation } from "@/components/inquiries/inquiry-conversation";

import { markMessagesRead, sendMessageWithAttachment } from "../actions";

interface ChatViewProps {
  readonly inquiry: Record<string, unknown>;
  readonly messages: Record<string, unknown>[];
  readonly arrangement: Record<string, unknown> | null;
  readonly fillHeight?: boolean;
  readonly onBack?: () => void;
}

export function ChatView({ inquiry, messages, arrangement, fillHeight, onBack }: ChatViewProps) {
  return (
    <InquiryConversation
      inquiry={inquiry}
      messages={messages}
      arrangement={arrangement}
      perspective="customer"
      sendMessage={sendMessageWithAttachment}
      markMessagesRead={markMessagesRead}
      fillHeight={fillHeight}
      onBack={onBack}
    />
  );
}
