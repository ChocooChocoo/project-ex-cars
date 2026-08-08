"use client";

import { useEffect, useState } from "react";

import { sendSupplierMessage } from "@/app/(staff)/supplier-messages/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
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
  const [msgs, setMsgs] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [supplierId, setSupplierId] = useState<string>(ownSupplierId ?? suppliers[0]?.id ?? "");
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("supplier-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "supplier_messages" }, (payload) => {
        setMsgs((prev) => [payload.new as SupplierMessage, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !supplierId) return;
    setSending(true);
    const fd = new FormData();
    fd.set("supplier_id", supplierId);
    fd.set("message_text", trimmed);
    setText("");
    await sendSupplierMessage(fd);
    setSending(false);
  }

  const visibleMessages = isCeo ? msgs : msgs.filter((m) => m.supplier_id === ownSupplierId);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Supplier Thread
            {!isCeo && ownSupplierId ? ` — ${suppliers.find((s) => s.id === ownSupplierId)?.business_name ?? ""}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visibleMessages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">No messages yet.</p>
          ) : (
            visibleMessages.map((m) => (
              <div key={m.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {m.sender_id === userId
                      ? "You"
                      : isCeo
                        ? (suppliers.find((s) => s.id === m.supplier_id)?.business_name ?? "Supplier")
                        : "GCE"}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{new Date(m.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm">{censorMessage(m.message_text)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {isCeo && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="msg-supplier">Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="msg-supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.business_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type a message..."
          />
          <Button onClick={handleSend} disabled={sending || !supplierId}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
