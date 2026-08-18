"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowLeft, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { sendSupplierMessage } from "@/app/(staff)/supplier-messages/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { cn, getInitials } from "@/lib/utils";
import { censorMessage } from "@/lib/word-filter";

interface SupplierMessage {
  id: string;
  supplier_id: string;
  sender_id: string;
  message_text: string;
  read_at: string | null;
  created_at: string;
}

interface SupplierSummary {
  id: string;
  business_name: string;
}

export function SupplierMessageThread({
  messages: initialMessages,
  suppliers,
  userId,
  isCeo,
  ownSupplierId,
}: {
  readonly messages: SupplierMessage[];
  readonly suppliers: SupplierSummary[];
  readonly userId: string;
  readonly isCeo: boolean;
  readonly ownSupplierId: string | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const initialSupplierId = ownSupplierId ?? (suppliers.length > 0 ? suppliers[0].id : "");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId);
  const [showThread, setShowThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel("supplier-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "supplier_messages" }, (payload) => {
        const nextMessage = payload.new as SupplierMessage;
        setMessages((current) =>
          current.some((message) => message.id === nextMessage.id) ? current : [...current, nextMessage],
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null;
  const visibleMessages = useMemo(
    () =>
      messages
        .filter((message) => message.supplier_id === selectedSupplierId)
        .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()),
    [messages, selectedSupplierId],
  );

  // Auto-scroll intentionally reruns when the selected thread's messages change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: visibleMessages is the explicit scroll trigger.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !selectedSupplierId || sending) return;

    setSending(true);
    const formData = new FormData();
    formData.set("supplier_id", selectedSupplierId);
    formData.set("message_text", trimmed);

    try {
      const result = await sendSupplierMessage(formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setText("");
    } catch {
      toast.error("Could not send this message.");
    } finally {
      setSending(false);
    }
  }

  const latestMessageBySupplier = new Map<string, SupplierMessage>();
  for (const message of messages) {
    const current = latestMessageBySupplier.get(message.supplier_id);
    if (!current || new Date(message.created_at) > new Date(current.created_at)) {
      latestMessageBySupplier.set(message.supplier_id, message);
    }
  }

  return (
    <div
      data-testid="supplier-chat-shell"
      className="grid h-[calc(100svh-var(--dashboard-header-height))] min-h-0 min-w-0 grid-cols-1 overflow-hidden shadow-sm transition-[grid-template-columns] duration-300 ease-out *:min-h-0 *:min-w-0 md:grid-cols-[22.5rem_minmax(0,1fr)] md:*:first:border-r"
    >
      <div
        className={cn(
          "relative z-0 flex min-h-0 min-w-0 flex-col gap-3 py-3 transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread && "max-md:pointer-events-none max-md:-translate-x-full",
        )}
      >
        <div className="flex items-center gap-4 px-2 py-0.5">
          <h1 className="font-medium text-xl leading-none">Supplier Messages</h1>
        </div>
        <Separator />
        <div className="flex min-h-0 flex-1 flex-col">
          {suppliers.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageSquare className="size-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">No supplier conversations yet.</p>
            </div>
          ) : (
            <ScrollArea
              type="hover"
              className="h-full min-h-0 flex-1 overflow-hidden [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5"
            >
              <div className="flex flex-col gap-1 p-2">
                {suppliers.map((supplier) => {
                  const latest = latestMessageBySupplier.get(supplier.id);
                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      data-testid="supplier-row"
                      className={cn(
                        "flex min-w-0 items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted",
                        selectedSupplierId === supplier.id && "bg-muted",
                      )}
                      onClick={() => {
                        setSelectedSupplierId(supplier.id);
                        setShowThread(true);
                      }}
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback>{getInitials(supplier.business_name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-sm">{supplier.business_name}</span>
                        <span className="block truncate text-muted-foreground text-xs">
                          {latest ? censorMessage(latest.message_text) : "No messages yet."}
                        </span>
                      </span>
                      {latest && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {new Date(latest.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative z-10 min-h-0 min-w-0 transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread ? "max-md:translate-x-0" : "max-md:pointer-events-none max-md:translate-x-full",
        )}
      >
        {selectedSupplier ? (
          <div className="flex h-full min-h-0 flex-col gap-3 py-3">
            <div className="flex items-center gap-3 px-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 md:hidden"
                aria-label="Back to conversations"
                onClick={() => setShowThread(false)}
                type="button"
              >
                <ArrowLeft />
              </Button>
              <Avatar className="size-8 shrink-0">
                <AvatarFallback>{getInitials(selectedSupplier.business_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium text-sm">{selectedSupplier.business_name}</div>
                <div className="text-muted-foreground text-xs">Approved supplier</div>
              </div>
            </div>
            <Separator />

            <ScrollArea
              type="hover"
              className="min-h-0 flex-1 [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5"
            >
              <div className="flex flex-col gap-6 px-2 py-8">
                {visibleMessages.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground text-sm">
                    No messages yet. Start the conversation.
                  </p>
                )}
                {visibleMessages.map((message) => {
                  const outbound = message.sender_id === userId;
                  return (
                    <div key={message.id} className={cn("flex items-end gap-2", outbound && "flex-row-reverse")}>
                      <Avatar className="shrink-0">
                        <AvatarFallback
                          className={cn(
                            "bg-muted text-foreground text-xs",
                            outbound && "bg-primary text-primary-foreground",
                          )}
                        >
                          {getInitials(outbound ? "You" : isCeo ? selectedSupplier.business_name : "GCE Auto")}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "flex max-w-md flex-col gap-2 rounded-xl px-4 py-3 text-sm",
                          outbound ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        <p className="leading-relaxed">{censorMessage(message.message_text)}</p>
                        <div
                          className={cn(
                            "text-muted-foreground/75 text-xs",
                            outbound && "text-right text-primary-foreground/75",
                          )}
                        >
                          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {message.read_at ? " · Read" : ""}
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
                  <Input
                    placeholder="Type a message..."
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageSquare className="size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">Select a supplier to view messages.</p>
          </div>
        )}
      </div>
    </div>
  );
}
