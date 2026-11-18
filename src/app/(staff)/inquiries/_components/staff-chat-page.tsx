"use client";

import { notFound } from "next/navigation";

import { loadThread } from "@/app/(customer)/my-inquiries/actions";
import { useSession } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { usePageData } from "@/lib/api/use-page-data";
import { useRouteParam } from "@/lib/routing/use-route-param";

import { StaffChatView } from "./staff-chat-view";

const THREAD_ROLES = ["ceo", "account_manager", "sales_manager", "marketing_specialist"];

export function StaffChatPage() {
  const id = useRouteParam("inquiries");
  const role = useSession().role;
  const allowed = role !== null && THREAD_ROLES.includes(role);
  // Laravel's InquiryPolicy: the Sales Manager reads buy threads, and (T01 Selling step 5) the Marketing
  // Specialist only the offer's own sell_negotiation thread. Anything else is a 404.
  const page = usePageData(`staff-inquiry/${id}`, () => (allowed ? loadThread(id) : Promise.resolve(null)));
  if (!allowed) notFound();
  if (!page.data) return <PageSkeleton />;
  if (!page.data.ok) notFound();
  const thread = page.data.data;

  return (
    <StaffChatView
      inquiry={thread.inquiry}
      messages={thread.messages}
      arrangement={thread.arrangement}
      userRole={role as string}
    />
  );
}
