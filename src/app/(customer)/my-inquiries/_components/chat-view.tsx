"use client";
"use no memo";

import { useEffect, useRef, useState } from "react";

import { markMessagesRead, sendMessage } from "@/app/(customer)/my-inquiries/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { censorMessage } from "@/lib/word-filter";

interface ChatViewProps {
  inquiry: Record<string, unknown>;
  messages: Record<string, unknown>[];
  arrangement: Record<string, unknown> | null;
}

export function ChatView({ inquiry, messages: initialMessages, arrangement }: ChatViewProps) {
  const [msgs, setMsgs] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const inquiryId = inquiry.id as string;
  const vehicles = inquiry.vehicles as Record<string, unknown> | undefined;
  const intention = inquiry.intention_kind as string;
  const state = inquiry.state as string;

  useEffect(() => {
    void markMessagesRead(inquiryId);

    const channel = supabase
      .channel(`inquiry-${inquiryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiry_messages", filter: `inquiry_id=eq.${inquiryId}` },
        (payload) => {
          setMsgs((prev) => [...prev, payload.new as Record<string, unknown>]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [inquiryId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    const fd = new FormData();
    fd.set("inquiry_id", inquiryId);
    fd.set("message_text", text);
    setText("");
    await sendMessage(fd);
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100dvh - var(--dashboard-header-height) - 3rem)" }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl leading-none tracking-tight">
            {vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : "Conversation"}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={intention === "buy_now" ? "default" : "secondary"} className="text-xs capitalize">
              {intention === "buy_now" ? "Buy Now" : "Inquiry"}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {state.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </div>

      {arrangement && (
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">
              {arrangement.arrangement_kind === "gce_visit"
                ? "GCE Visit"
                : arrangement.arrangement_kind === "meetup"
                  ? "CALABARZON Meet-Up"
                  : "Delivery"}{" "}
              — {new Date(arrangement.schedule as string).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <p className="py-8 text-center text-muted-foreground text-sm">No messages yet. Start the conversation.</p>
          )}
          {msgs.map((m, _i) => (
            <div
              key={m.id as string}
              className={`flex ${(m.sender_id as string) === inquiry.customer_id ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${(m.sender_id as string) === inquiry.customer_id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {m.message_text ? censorMessage(m.message_text as string) : null}
                {(m.message_attachments as Record<string, unknown>[] | undefined)?.map((att) => (
                  <div key={att.id as string} className="mt-1 text-xs opacity-70">
                    {att.original_name as string}
                  </div>
                ))}
                <div className="mt-1 text-xs opacity-60">
                  {new Date(m.sent_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </CardContent>
        <Separator />
        <div className="flex items-center gap-2 p-3">
          <Input
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend();
            }}
          />
          <Button size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
