import { notFound } from "next/navigation";

import { ChatView } from "../_components/chat-view";
import { loadThread } from "../actions";

export default async function InquiryChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Another customer's thread, a bad id or a signed-out session all render the 404 page, as before.
  const thread = await loadThread(id);
  if (!thread.ok) notFound();

  return (
    <ChatView inquiry={thread.data.inquiry} messages={thread.data.messages} arrangement={thread.data.arrangement} />
  );
}
