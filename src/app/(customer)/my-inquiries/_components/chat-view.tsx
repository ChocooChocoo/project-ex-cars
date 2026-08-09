"use client";
"use no memo";

import { useEffect, useRef, useState } from "react";

import { format } from "date-fns";
import { ArrowLeft, Paperclip } from "lucide-react";

import { markMessagesRead, sendMessageWithAttachment } from "@/app/(customer)/my-inquiries/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { cn, getInitials } from "@/lib/utils";
import { censorMessage } from "@/lib/word-filter";

interface ChatViewProps {
  inquiry: Record<string, unknown>;
  messages: Record<string, unknown>[];
  arrangement: Record<string, unknown> | null;
  fillHeight?: boolean;
  onBack?: () => void;
}

export function ChatView({
  inquiry,
  messages: initialMessages,
  arrangement,
  fillHeight = false,
  onBack,
}: ChatViewProps) {
  const [msgs, setMsgs] = useState(initialMessages);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [myInitials, setMyInitials] = useState("ME");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const inquiryId = inquiry.id as string;
  const vehicles = inquiry.vehicles as Record<string, unknown> | undefined;
  const intention = inquiry.intention_kind as string;
  const state = inquiry.state as string;
  const vehicleName = vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : "Conversation";
  const dividerDate =
    msgs.length > 0
      ? format(new Date(msgs[0].sent_at as string), "MMM d, yyyy")
      : format(new Date((inquiry.created_at as string) ?? Date.now()), "MMM d, yyyy");

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      const name = typeof meta?.full_name === "string" ? meta.full_name : data.user?.email;
      setMyInitials(name ? getInitials(name) : "ME");
    });
  }, [supabase]);

  async function handleSend() {
    if (!text.trim() && !file) return;
    setSending(true);
    const fd = new FormData();
    fd.set("inquiry_id", inquiryId);
    fd.set("message_text", text);
    if (file) {
      fd.set("file", file);
      setFile(null);
    }
    setText("");
    await sendMessageWithAttachment(fd);
    setSending(false);
  }

  return (
    <div
      className={cn("flex min-h-0 flex-col gap-3 py-3", fillHeight && "h-full")}
      style={fillHeight ? undefined : { height: "calc(100dvh - var(--dashboard-header-height) - 3rem)" }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 px-2">
          <div className="flex min-w-0 items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="Back to conversations"
                onClick={onBack}
              >
                <ArrowLeft />
              </Button>
            )}
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-background text-foreground">{getInitials(vehicleName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium text-sm">{vehicleName}</div>
              <div className="truncate text-muted-foreground text-xs capitalize leading-3">
                {intention === "buy_now" ? "Buy Now" : "Inquiry"} · {state.replace("_", " ")}
              </div>
            </div>
          </div>
        </div>

        <Separator />
      </div>

      {arrangement && (
        <div className="px-2">
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm">
                {arrangement.arrangement_kind === "gce_visit"
                  ? "GCE Visit"
                  : arrangement.arrangement_kind === "meetup"
                    ? "CALABARZON Meet-Up"
                    : "Delivery"}{" "}
                — {new Date(arrangement.schedule as string).toLocaleString()}
                {(arrangement.location as string) ? ` at ${arrangement.location as string}` : null}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <ScrollArea
        type="hover"
        className="min-h-0 flex-1 [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5"
      >
        <div className="flex flex-col gap-6 px-2 py-8">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground text-xs">{dividerDate}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {msgs.length === 0 && (
            <p className="py-8 text-center text-muted-foreground text-sm">No messages yet. Start the conversation.</p>
          )}

          {msgs.map((m) => {
            const isOutbound = (m.sender_id as string) === inquiry.customer_id;
            const senderInitials = isOutbound ? myInitials : getInitials("GCE Auto");

            return (
              <div key={m.id as string} className={cn("flex items-end gap-2", isOutbound && "flex-row-reverse")}>
                <Avatar className="shrink-0">
                  <AvatarFallback
                    className={cn(
                      "bg-muted text-foreground text-xs",
                      isOutbound && "bg-primary text-primary-foreground",
                    )}
                  >
                    {senderInitials}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    "flex max-w-md flex-col gap-2 rounded-xl px-4 py-3 text-sm",
                    isOutbound ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <p className="leading-relaxed">{m.message_text ? censorMessage(m.message_text as string) : null}</p>
                  {(m.message_attachments as Record<string, unknown>[] | undefined)?.map((att) => (
                    <div key={att.id as string} className="text-xs opacity-70">
                      {att.original_name as string}
                    </div>
                  ))}
                  <div
                    className={cn(
                      "text-muted-foreground/75 text-xs",
                      isOutbound && "text-right text-primary-foreground/75",
                    )}
                  >
                    {new Date(m.sent_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {m.read_at ? " · Read" : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="px-2">
        <div className="rounded-md border">
          <div className="flex items-center gap-2 p-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              aria-label="Attach file"
            >
              <Paperclip className="size-4" />
            </Button>
            <Input
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSend();
              }}
            />
            <Button size="sm" onClick={handleSend} disabled={sending || (!text.trim() && !file)}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>

      {file && (
        <div className="px-2">
          <Badge variant="secondary" className="max-w-full truncate text-xs">
            {file.name}
          </Badge>
        </div>
      )}
    </div>
  );
}
