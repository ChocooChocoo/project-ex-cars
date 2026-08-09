"use client";

import { useEffect, useMemo, useState } from "react";

import { Filter, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { filterInquiries, InquiryList } from "./inquiry-list";
import type { InquiryChatShellProps, InquiryFilter, InquiryThreadData } from "./types";

const ACTIVE_STATES = ["assigned", "scheduled", "handed_off"];

export function InquiryChatShell({
  title,
  inquiries,
  unreadByInquiry = {},
  emptyMessage,
  loadThread,
  renderThread,
}: InquiryChatShellProps) {
  const [filter, setFilter] = useState<InquiryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(() => (inquiries[0]?.id as string) ?? null);
  const [thread, setThread] = useState<InquiryThreadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [showThread, setShowThread] = useState(false);

  const visibleInquiries = useMemo(() => filterInquiries(inquiries, filter), [inquiries, filter]);
  const counts = useMemo(
    () => ({
      all: inquiries.length,
      active: inquiries.filter((inq) => ACTIVE_STATES.includes(inq.state as string)).length,
      open: inquiries.filter((inq) => inq.state === "open").length,
      closed: inquiries.filter((inq) => inq.state === "closed").length,
    }),
    [inquiries],
  );

  useEffect(() => {
    const visibleIds = new Set(visibleInquiries.map((inq) => inq.id as string));
    if (selectedId && visibleIds.has(selectedId)) return;

    const nextId = (visibleInquiries[0]?.id as string) ?? null;
    setSelectedId(nextId);
    setShowThread(false);
  }, [selectedId, visibleInquiries]);

  // Retry intentionally reruns this effect without changing the selected inquiry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is the explicit retry trigger.
  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setThread(null);
    setLoadError(null);

    loadThread(selectedId)
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (!result.ok) {
          setLoadError(result.message);
          toast.error(result.message);
          return;
        }
        setThread(result.data);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadError("Could not load this conversation.");
        toast.error("Could not load this conversation.");
      });

    return () => {
      cancelled = true;
    };
  }, [loadThread, reloadToken, selectedId]);

  const empty = inquiries.length === 0;

  return (
    <div
      data-testid="inquiry-chat-shell"
      className="grid h-[calc(100svh-var(--dashboard-header-height))] min-h-0 min-w-0 grid-cols-1 overflow-hidden shadow-sm transition-[grid-template-columns] duration-300 ease-out *:min-h-0 *:min-w-0 md:grid-cols-[22.5rem_minmax(0,1fr)] md:*:first:border-r"
    >
      <div
        className={cn(
          "relative z-0 flex min-h-0 min-w-0 flex-col gap-3 py-3 transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread && "max-md:pointer-events-none max-md:-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-4 px-2 py-0.5">
          <h1 className="font-medium text-xl leading-none">{title}</h1>
          <Button variant="ghost" size="icon-sm" aria-label="Filter conversations" type="button">
            <Filter />
          </Button>
        </div>

        <Separator />

        <Tabs value={filter} onValueChange={(value) => setFilter(value as InquiryFilter)} className="min-h-0">
          <TabsList variant="line" className="w-full border-b px-0 **:data-[slot=tabs-trigger]:border-x-0">
            <TabsTrigger value="all">
              All <span className="text-muted-foreground text-xs">({counts.all})</span>
            </TabsTrigger>
            <TabsTrigger value="active">
              Active <span className="text-muted-foreground text-xs">({counts.active})</span>
            </TabsTrigger>
            <TabsTrigger value="open">
              Open <span className="text-muted-foreground text-xs">({counts.open})</span>
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed <span className="text-muted-foreground text-xs">({counts.closed})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex min-h-0 flex-1 flex-col">
          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageSquare className="size-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">{emptyMessage}</p>
            </div>
          ) : visibleInquiries.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageSquare className="size-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">No conversations match this filter.</p>
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
                  unreadByInquiry={unreadByInquiry}
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
          "relative z-10 min-h-0 min-w-0 transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
          showThread ? "max-md:translate-x-0" : "max-md:pointer-events-none max-md:translate-x-full",
        )}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <MessageSquare className="size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
              Retry
            </Button>
          </div>
        ) : thread ? (
          renderThread(thread, () => setShowThread(false))
        ) : selectedId ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageSquare className="size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">No conversation selected.</p>
          </div>
        )}
      </div>
    </div>
  );
}
