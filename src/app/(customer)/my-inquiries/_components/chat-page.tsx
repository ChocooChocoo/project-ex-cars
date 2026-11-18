"use client";

import { notFound } from "next/navigation";

import { PageSkeleton } from "@/components/page-skeleton";
import { usePageData } from "@/lib/api/use-page-data";
import { useRouteParam } from "@/lib/routing/use-route-param";

import { loadThread } from "../actions";
import { ChatView } from "./chat-view";

export function ChatPage() {
  const id = useRouteParam("my-inquiries");
  // Another customer's thread, a bad id or a signed-out session all render the 404 page, as before.
  const page = usePageData(`my-inquiries/${id}`, () => loadThread(id));
  if (!page.data) return <PageSkeleton />;
  if (!page.data.ok) notFound();
  const thread = page.data.data;

  return <ChatView inquiry={thread.inquiry} messages={thread.messages} arrangement={thread.arrangement} />;
}
