"use client";

import { useEffect, useMemo, useState } from "react";

import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { type InquiryFilter, InquiryList } from "@/app/(customer)/my-inquiries/_components/inquiry-list";
import { getInquiryThread } from "@/app/(customer)/my-inquiries/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { StaffChatView } from "./staff-chat-view";

interface InquiryThread {
  inquiry: Record<string, unknown>;
  messages: Record<string, unknown>[];
  arrangement: Record<string, unknown> | null;
}

interface StaffInquiryChatProps {
  readonly inquiries: Record<string, unknown>[];
  readonly userRole: string;
}

const ACTIVE_STATES = ["assigned", "scheduled", "handed_off"];

export function StaffInquiryChat({ inquiries, userRole }: StaffInquiryChatProps) {
  const [selectedId, setSelectedId] = useState<string | null>((inquiries[0]?.id as string) ?? null);
  const [thread, setThread] = useState<InquiryThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [filter, setFilter] = useState<InquiryFilter>("all");

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getInquiryThread(selectedId)
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (res.error || !res.inquiry) {
          toast.error(res.error ?? "Could not load this conversation.");
          return;
        }
        setThread({
          inquiry: res.inquiry,
          messages: res.messages ?? [],
          arrangement: res.arrangement ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const counts = useMemo(
    () => ({
      all: inquiries.length,
      active: inquiries.filter((inq) => ACTIVE_STATES.includes(inq.state as string)).length,
      open: inquiries.filter((inq) => inq.state === "open").length,
      closed: inquiries.filter((inq) => inq.state === "closed").length,
    }),
    [inquiries],
  );

  const empty = inquiries.length === 0;

  return (
    <div className="grid h-[calc(100svh-var(--dashboard-header-height))] min-h-0 min-w-0 grid-cols-1 overflow-hidden shadow-sm transition-[grid-template-columns] duration-300 ease-out *:min-h-0 *:min-w-0 md:grid-cols-[22.5rem_minmax(0,1fr)] md:*:first:border-r">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col gap-3 py-3 transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread && "max-md:pointer-events-none max-md:-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-4 px-2 py-0.5">
          <h1 className="font-medium text-xl leading-none">Inquiries Queue</h1>
        </div>

        <Separator />

        <Tabs value={filter} onValueChange={(value) => setFilter(value as InquiryFilter)}>
          <TabsList variant="line" className="w-full border-b px-0 **:data-[slot=tabs-trigger]:border-x-0">
            <TabsTrigger value="all">
              All
              <span className="text-muted-foreground text-xs">({counts.all})</span>
            </TabsTrigger>
            <TabsTrigger value="active">
              Active
              <span className="text-muted-foreground text-xs">({counts.active})</span>
            </TabsTrigger>
            <TabsTrigger value="open">
              Open
              <span className="text-muted-foreground text-xs">({counts.open})</span>
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed
              <span className="text-muted-foreground text-xs">({counts.closed})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex min-h-0 flex-1 flex-col">
          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageSquare className="size-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">No inquiries yet. Conversations appear here once started.</p>
            </div>
          ) : (
            <ScrollArea
              type="hover"
              className="h-full min-h-0 flex-1 overflow-hidden [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5"
            >
              <div className="flex flex-col gap-3 pt-0">
                <InquiryList
                  inquiries={inquiries}
                  filter={filter}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setShowThread(true);
                  }}
                />
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 min-w-0 transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread ? "max-md:translate-x-0" : "max-md:pointer-events-none max-md:translate-x-full",
        )}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : thread ? (
          <StaffChatView
            key={selectedId as string}
            inquiry={thread.inquiry}
            messages={thread.messages}
            arrangement={thread.arrangement}
            userRole={userRole}
            fillHeight
            onBack={() => setShowThread(false)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageSquare className="size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">Select a conversation to view messages.</p>
          </div>
        )}
      </div>
    </div>
  );
}
