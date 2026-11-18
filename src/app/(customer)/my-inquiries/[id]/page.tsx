import { ChatPage } from "../_components/chat-page";

// Static build: one page under the placeholder id (see src/lib/routing/htaccess.ts).
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <ChatPage />;
}
