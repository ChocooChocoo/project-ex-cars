"use client";
"use no memo";

import { type ReactElement, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { format } from "date-fns";
import { ArrowLeft, FileText, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { getMessageAttachment, prepareMessageAttachment } from "@/app/(customer)/my-inquiries/actions";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  attachmentError,
  attachmentMimeType,
  MESSAGE_ATTACHMENT_ACCEPT,
  MESSAGE_ATTACHMENTS_BUCKET,
  type SignedAttachment,
} from "@/lib/inquiries/attachments";
import { createClient } from "@/lib/supabase/client";
import { cn, getInitials } from "@/lib/utils";
import { censorMessage } from "@/lib/word-filter";

import type { InquiryRecord } from "./types";

type InquiryAction = (formData: FormData) => Promise<unknown>;
type MarkMessagesReadAction = (inquiryId: string) => Promise<unknown>;

export interface InquiryConversationProps {
  readonly inquiry: InquiryRecord;
  readonly messages: InquiryRecord[];
  readonly arrangement: InquiryRecord | null;
  readonly perspective: "customer" | "staff";
  readonly sendMessage: InquiryAction;
  readonly markMessagesRead: MarkMessagesReadAction;
  readonly headerActions?: ReactElement | null;
  readonly beforeMessages?: ReactNode;
  readonly fillHeight?: boolean;
  readonly onBack?: () => void;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function AttachmentView({
  attachment,
  outbound,
}: {
  readonly attachment: SignedAttachment;
  readonly outbound: boolean;
}) {
  const url = attachment.signed_url;
  if (!url) {
    return <p className="text-xs opacity-75">{attachment.original_name} (unavailable)</p>;
  }
  if (attachment.file_kind === "image") {
    return (
      <TransactionImagePreview
        src={url}
        alt={attachment.original_name}
        triggerClassName="h-40 w-56 max-w-full bg-background/40"
        className="object-cover"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={attachment.original_name}
      className={cn(
        "flex max-w-full items-center gap-2 rounded-md border px-2.5 py-2 text-xs underline-offset-2 hover:underline",
        outbound ? "border-primary-foreground/30" : "border-border bg-background",
      )}
    >
      <FileText className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{attachment.original_name}</span>
      <span className="shrink-0 opacity-75">{formatSize(attachment.file_size)}</span>
    </a>
  );
}

function withAttachment(
  prev: Record<string, SignedAttachment[]>,
  attachment: SignedAttachment,
): Record<string, SignedAttachment[]> {
  const current = prev[attachment.message_id] ?? [];
  if (current.some((item) => item.id === attachment.id)) return prev;
  return { ...prev, [attachment.message_id]: [...current, attachment] };
}

function getActionError(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  if ("ok" in result && result.ok === false && "message" in result && typeof result.message === "string") {
    return result.message;
  }
  if ("error" in result && typeof result.error === "string") return result.error;
  return null;
}

export function InquiryConversation({
  inquiry,
  messages: initialMessages,
  arrangement,
  perspective,
  sendMessage,
  markMessagesRead,
  headerActions,
  beforeMessages,
  fillHeight = false,
  onBack,
}: InquiryConversationProps) {
  const [msgs, setMsgs] = useState(initialMessages);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Files that arrive after their message (realtime) or come back from our own send, keyed by message id.
  const [extraAttachments, setExtraAttachments] = useState<Record<string, SignedAttachment[]>>({});
  const [sending, setSending] = useState(false);
  const [myInitials, setMyInitials] = useState("ME");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const inquiryId = inquiry.id as string;
  const vehicles = inquiry.vehicles as Record<string, unknown> | undefined;
  const profile = inquiry.profiles as Record<string, unknown> | undefined;
  const intention = inquiry.intention_kind as string;
  const state = inquiry.state as string;
  const vehicleName = vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : "Conversation";
  const customerName = (profile?.full_name as string | null | undefined) || "Customer";
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
          setMsgs((prev) => {
            const nextMessage = payload.new as InquiryRecord;
            return prev.some((message) => message.id === nextMessage.id) ? prev : [...prev, nextMessage];
          });
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_attachments" }, (payload) => {
        // The table has no inquiry_id and realtime filters cannot prefix-match, so filter on the
        // storage path, which the server always puts under `${inquiryId}/`.
        const row = payload.new as { id?: string; storage_path?: string };
        if (!row.id || !row.storage_path?.startsWith(`${inquiryId}/`)) return;
        void getMessageAttachment(row.id).then((attachment) => {
          if (attachment) setExtraAttachments((prev) => withAttachment(prev, attachment));
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [inquiryId, markMessagesRead, supabase]);

  // The message collection is the scroll trigger for initial and realtime messages.
  // biome-ignore lint/correctness/useExhaustiveDependencies: msgs intentionally triggers auto-scroll.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      const name = typeof meta?.full_name === "string" ? meta.full_name : data.user?.email;
      setMyInitials(name ? getInitials(name) : "ME");
    });
  }, [supabase]);

  function pickFile(picked: File | null) {
    const error = picked ? attachmentError({ name: picked.name, type: picked.type, size: picked.size }) : null;
    setFileError(error);
    setFile(error ? null : picked);
    if (error && fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearFile() {
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend() {
    if (!text.trim() && !file) return;
    setSending(true);
    const fd = new FormData();
    fd.set("inquiry_id", inquiryId);
    fd.set("message_text", text);

    try {
      if (file) {
        // The file goes straight to storage on a signed URL; only its path goes through the server action.
        const type = attachmentMimeType(file);
        const prepared = await prepareMessageAttachment(inquiryId, { name: file.name, type, size: file.size });
        if ("error" in prepared) {
          setFileError(prepared.error);
          toast.error(prepared.error);
          return;
        }
        const { error: uploadError } = await supabase.storage
          .from(MESSAGE_ATTACHMENTS_BUCKET)
          .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: type });
        if (uploadError) {
          const message = `The file did not upload: ${uploadError.message}`;
          setFileError(message);
          toast.error(message);
          return;
        }
        fd.set("attachment_path", prepared.path);
        fd.set("attachment_name", file.name);
        fd.set("attachment_type", type);
        fd.set("attachment_size", String(file.size));
      }

      const result = await sendMessage(fd);
      const error = getActionError(result);
      if (error) {
        if (file) setFileError(error);
        toast.error(error);
        return;
      }
      const sent = result as { attachment?: SignedAttachment | null };
      const sentAttachment = sent.attachment;
      if (sentAttachment) setExtraAttachments((prev) => withAttachment(prev, sentAttachment));

      setText("");
      clearFile();
    } catch {
      toast.error("Could not send this message.");
    } finally {
      setSending(false);
    }
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
                className="shrink-0 md:hidden"
                aria-label="Back to conversations"
                onClick={onBack}
                type="button"
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
          {headerActions ? <div className="flex flex-wrap items-center justify-end gap-2">{headerActions}</div> : null}
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

      {beforeMessages}

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

          {msgs.map((message) => {
            const isCustomerMessage = (message.sender_id as string) === inquiry.customer_id;
            const isOutbound = perspective === "customer" ? isCustomerMessage : !isCustomerMessage;
            const senderInitials = isOutbound
              ? perspective === "customer"
                ? myInitials
                : getInitials("GCE Auto")
              : perspective === "customer"
                ? getInitials("GCE Auto")
                : getInitials(customerName);

            return (
              <div key={message.id as string} className={cn("flex items-end gap-2", isOutbound && "flex-row-reverse")}>
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
                  <p className="leading-relaxed">
                    {message.message_text ? censorMessage(message.message_text as string) : null}
                  </p>
                  {[
                    ...((message.message_attachments as SignedAttachment[] | undefined) ?? []),
                    ...(extraAttachments[message.id as string] ?? []).filter(
                      (extra) =>
                        !(message.message_attachments as SignedAttachment[] | undefined)?.some(
                          (attachment) => attachment.id === extra.id,
                        ),
                    ),
                  ].map((attachment) => (
                    <AttachmentView key={attachment.id} attachment={attachment} outbound={isOutbound} />
                  ))}
                  <div
                    className={cn(
                      "text-muted-foreground/75 text-xs",
                      isOutbound && "text-right text-primary-foreground/75",
                    )}
                  >
                    {new Date(message.sent_at as string).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
            <input
              ref={fileInputRef}
              type="file"
              accept={MESSAGE_ATTACHMENT_ACCEPT}
              className="hidden"
              aria-label="Attach an image or PDF"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
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
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSend();
              }}
            />
            <Button size="sm" onClick={handleSend} disabled={sending || (!text.trim() && !file)}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>

      {file || fileError ? (
        <div className="flex flex-col gap-1 px-2">
          {file ? (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="max-w-full truncate text-xs">
                {file.name} · {formatSize(file.size)}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={clearFile}
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : null}
          {fileError ? (
            <p role="alert" className="text-destructive text-xs">
              {fileError}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="px-2 text-muted-foreground text-xs">Images (JPG, PNG, WebP) or PDF, up to 10 MB.</p>
      )}
    </div>
  );
}
