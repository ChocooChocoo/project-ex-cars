import type { ReactNode } from "react";

import type { ActionResult } from "@/lib/auth/action-result";

export type InquiryRecord = Record<string, unknown>;

export interface InquiryThreadData {
  inquiry: InquiryRecord;
  messages: InquiryRecord[];
  arrangement: InquiryRecord | null;
}

export type InquiryThreadLoader = (inquiryId: string) => Promise<ActionResult<InquiryThreadData>>;

export type InquiryFilter = "all" | "active" | "open" | "closed";

export interface InquiryChatShellProps {
  readonly title: string;
  readonly inquiries: InquiryRecord[];
  readonly unreadByInquiry?: Record<string, number>;
  readonly emptyMessage: string;
  readonly loadThread: InquiryThreadLoader;
  readonly renderThread: (thread: InquiryThreadData, onBack: () => void) => ReactNode;
}
