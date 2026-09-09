"use client";

import { useMemo, useState } from "react";

import { InquiryChatShell } from "@/components/inquiries/inquiry-chat-shell";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { getStaffInquiryThread } from "../actions";
import { StaffChatView } from "./staff-chat-view";

interface StaffInquiryChatProps {
  readonly inquiries: Record<string, unknown>[];
  readonly unreadByInquiry?: Record<string, number>;
  readonly userRole: string;
  readonly currentUserId?: string | null;
}

type InquiryQuickFilter = "all" | "needs_reply" | "assigned_to_me";

export function StaffInquiryChat({
  inquiries,
  unreadByInquiry = {},
  userRole,
  currentUserId = null,
}: StaffInquiryChatProps) {
  const [quickFilter, setQuickFilter] = useState<InquiryQuickFilter>("all");

  const filteredInquiries = useMemo(() => {
    if (quickFilter === "needs_reply") {
      return inquiries.filter((inq) => (unreadByInquiry[inq.id as string] ?? 0) > 0);
    }
    if (quickFilter === "assigned_to_me" && currentUserId) {
      return inquiries.filter(
        (inq) =>
          (inq.assigned_account_manager as string | null) === currentUserId ||
          (inq.assigned_sales_manager as string | null) === currentUserId,
      );
    }
    return inquiries;
  }, [inquiries, quickFilter, unreadByInquiry, currentUserId]);

  const needsReplyCount = useMemo(
    () => inquiries.filter((inq) => (unreadByInquiry[inq.id as string] ?? 0) > 0).length,
    [inquiries, unreadByInquiry],
  );
  const assignedToMeCount = useMemo(() => {
    if (!currentUserId) return 0;
    return inquiries.filter(
      (inq) =>
        (inq.assigned_account_manager as string | null) === currentUserId ||
        (inq.assigned_sales_manager as string | null) === currentUserId,
    ).length;
  }, [inquiries, currentUserId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={1}
          aria-label="Inquiry quick filter"
          value={quickFilter}
          onValueChange={(value) => {
            if (value) setQuickFilter(value as InquiryQuickFilter);
          }}
          data-testid="inquiry-quick-filter"
        >
          <ToggleGroupItem value="all" aria-label="All inquiries">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="needs_reply" aria-label="Needs reply">
            Needs reply
          </ToggleGroupItem>
          <ToggleGroupItem value="assigned_to_me" aria-label="Assigned to me">
            Assigned to me
          </ToggleGroupItem>
        </ToggleGroup>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {filteredInquiries.length} / {inquiries.length}
        </Badge>
        {quickFilter === "needs_reply" && needsReplyCount === 0 ? (
          <span className="text-muted-foreground text-xs">No threads need reply</span>
        ) : null}
        {quickFilter === "assigned_to_me" && assignedToMeCount === 0 ? (
          <span className="text-muted-foreground text-xs">None assigned to you</span>
        ) : null}
      </div>
      <InquiryChatShell
        title="Inquiries Queue"
        inquiries={filteredInquiries}
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
    </div>
  );
}
