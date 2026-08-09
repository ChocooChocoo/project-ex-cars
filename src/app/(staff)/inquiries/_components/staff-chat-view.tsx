"use client";
"use no memo";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { ArrowLeft, Paperclip } from "lucide-react";
import { toast } from "sonner";

import {
  acceptHandoff,
  assignInquiry,
  handoffInquiry,
  markMessagesRead,
  scheduleArrangement,
  sendMessageWithAttachment,
} from "@/app/(customer)/my-inquiries/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { censorMessage } from "@/lib/word-filter";

interface StaffChatViewProps {
  inquiry: Record<string, unknown>;
  messages: Record<string, unknown>[];
  arrangement: Record<string, unknown> | null;
  userRole: string;
  fillHeight?: boolean;
  onBack?: () => void;
}

export function StaffChatView({
  inquiry,
  messages: initialMessages,
  arrangement: initialArrangement,
  userRole,
  fillHeight = false,
  onBack,
}: StaffChatViewProps) {
  const router = useRouter();
  const [msgs, setMsgs] = useState(initialMessages);
  const [arr, setArr] = useState(initialArrangement);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showArrangement, setShowArrangement] = useState(false);
  const [arrKind, setArrKind] = useState("gce_visit");
  const [arrSchedule, setArrSchedule] = useState("");
  const [arrLocation, setArrLocation] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const inquiryId = inquiry.id as string;
  const vehicles = inquiry.vehicles as Record<string, unknown> | undefined;
  const intention = inquiry.intention_kind as string;
  const state = inquiry.state as string;
  const handoffState = (inquiry.handoff_state as string | null | undefined) ?? "none";
  const hasManager =
    (inquiry.assigned_account_manager as string | null | undefined) ||
    (inquiry.assigned_sales_manager as string | null | undefined);
  const canRequestHandoff = ["ceo", "account_manager"].includes(userRole);
  const canAcceptHandoff = ["ceo", "sales_manager"].includes(userRole);

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

  async function handleAssign() {
    if (assigning) return;
    setAssigning(true);
    const role = intention === "buy_now" ? "sales_manager" : "account_manager";
    const result = await assignInquiry(inquiryId, role);
    setAssigning(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Inquiry assigned to you.");
    router.refresh();
  }

  async function handleSchedule() {
    const fd = new FormData();
    fd.set("inquiry_id", inquiryId);
    fd.set("arrangement_kind", arrKind);
    fd.set("schedule", arrSchedule);
    fd.set("location", arrLocation);
    const result = await scheduleArrangement(fd);
    if (result.success) {
      setArr({ arrangement_kind: arrKind, schedule: arrSchedule, location: result.location ?? arrLocation });
      setShowArrangement(false);
    }
  }

  return (
    <div
      className={cn("flex min-h-0 flex-col gap-4", fillHeight ? "h-full" : "")}
      style={fillHeight ? undefined : { height: "calc(100dvh - var(--dashboard-header-height) - 3rem)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {onBack ? (
            <Button variant="ghost" size="icon-sm" className="shrink-0 md:hidden" onClick={onBack} type="button">
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-xl leading-none tracking-tight">
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
        <div className="flex items-center gap-2">
          {!hasManager && (
            <Button size="sm" onClick={handleAssign} disabled={assigning}>
              {assigning ? "Assigning..." : "Assign to Me"}
            </Button>
          )}
          {state === "scheduled" && handoffState === "none" && canRequestHandoff && (
            <Button size="sm" variant="outline" onClick={() => handoffInquiry(inquiryId)}>
              Request Handoff
            </Button>
          )}
          {handoffState === "pending_handoff" && canAcceptHandoff && (
            <Button size="sm" variant="outline" onClick={() => acceptHandoff(inquiryId)}>
              Accept Handoff
            </Button>
          )}
          {handoffState === "handed_off" && (
            <Badge variant="secondary" className="text-xs">
              Handed off to Sales Manager
            </Badge>
          )}
          {hasManager && !arr && (
            <Button size="sm" variant="outline" onClick={() => setShowArrangement(!showArrangement)}>
              Schedule
            </Button>
          )}
        </div>
      </div>

      {arr && (
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">
              {arr.arrangement_kind === "gce_visit"
                ? "GCE Visit"
                : arr.arrangement_kind === "meetup"
                  ? "CALABARZON Meet-Up"
                  : "Delivery"}{" "}
              — {new Date(arr.schedule as string).toLocaleString()}
              {(arr.location as string) ? ` at ${arr.location as string}` : null}
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {showArrangement && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">New Arrangement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FieldGroup className="gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <Select value={arrKind} onValueChange={setArrKind}>
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="gce_visit">GCE Visit</SelectItem>
                        <SelectItem value="meetup">CALABARZON Meet-Up</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Schedule</FieldLabel>
                  <Input type="datetime-local" value={arrSchedule} onChange={(e) => setArrSchedule(e.target.value)} />
                </Field>
              </div>
              <Field>
                <FieldLabel>Location</FieldLabel>
                <Input
                  value={arrLocation}
                  onChange={(e) => setArrLocation(e.target.value)}
                  placeholder="GCE Office, CALABARZON"
                />
              </Field>
            </FieldGroup>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSchedule} disabled={!arrSchedule}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowArrangement(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.length === 0 && <p className="py-8 text-center text-muted-foreground text-sm">No messages yet.</p>}
          {msgs.map((m) => {
            const isCustomer = (m.sender_id as string) === inquiry.customer_id;
            return (
              <div key={m.id as string} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isCustomer ? "bg-muted" : "bg-primary text-primary-foreground"}`}
                >
                  {m.message_text ? censorMessage(m.message_text as string) : null}
                  {(m.message_attachments as Record<string, unknown>[] | undefined)?.map((att) => (
                    <div key={att.id as string} className="mt-1 text-xs opacity-70">
                      {att.original_name as string}
                    </div>
                  ))}
                  <div className="mt-1 text-xs opacity-60">
                    {new Date(m.sent_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {m.read_at ? " · Read" : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </CardContent>
        <Separator />
        <div className="flex items-center gap-2 p-3">
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
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
