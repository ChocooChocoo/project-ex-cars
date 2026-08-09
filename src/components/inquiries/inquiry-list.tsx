"use client";

import Link from "next/link";

import { ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn, getInitials } from "@/lib/utils";

import type { InquiryFilter, InquiryRecord } from "./types";

interface InquiryGroup {
  key: string;
  label: string;
  matches: string[];
}

const GROUPS: InquiryGroup[] = [
  { key: "active", label: "Active", matches: ["assigned", "scheduled", "handed_off"] },
  { key: "open", label: "Open", matches: ["open"] },
  { key: "closed", label: "Closed", matches: ["closed"] },
];

const ACTIVE_STATES = ["assigned", "scheduled", "handed_off"];

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function filterInquiries(inquiries: InquiryRecord[], filter: InquiryFilter): InquiryRecord[] {
  if (filter === "all") return inquiries;
  return inquiries.filter((inq) => {
    const state = inq.state as string;
    if (filter === "active") return ACTIVE_STATES.includes(state);
    return state === filter;
  });
}

interface InquiryListProps {
  readonly inquiries: InquiryRecord[];
  readonly baseUrl?: string;
  readonly selectedId?: string | null;
  readonly onSelect?: (id: string) => void;
  readonly filter?: InquiryFilter;
  readonly unreadByInquiry?: Record<string, number>;
}

export function InquiryList({
  inquiries,
  baseUrl,
  selectedId,
  onSelect,
  filter = "all",
  unreadByInquiry = {},
}: InquiryListProps) {
  const visible = filterInquiries(inquiries, filter);

  const groups = GROUPS.map((group) => ({
    ...group,
    items: visible.filter((inq) => group.matches.includes(inq.state as string)),
  })).filter((group) => group.items.length > 0);

  return (
    <div data-testid="inquiry-list" className="flex flex-col gap-1 px-2">
      {groups.map(({ key, label, items }) => (
        <Collapsible key={key} defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-1 px-3 py-2 font-medium text-muted-foreground text-xs hover:text-foreground [&[data-state=open]>svg]:rotate-180">
            {label}
            <ChevronDown className="size-3 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-1">
              {items.map((inq) => {
                const id = inq.id as string;
                const vehicles = inq.vehicles as Record<string, unknown> | undefined;
                const intention = inq.intention_kind as string;
                const state = inq.state as string;
                const updatedAt = inq.updated_at as string | null;
                const name = vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : "Vehicle";
                const initialsName = vehicles ? `${vehicles.make} ${vehicles.model}` : "Vehicle";
                const unread = unreadByInquiry[id] ?? 0;

                const content = (
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Avatar className="shrink-0">
                      <AvatarFallback className="text-foreground text-xs">
                        {getInitials(initialsName).slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="w-0 flex-1 overflow-hidden">
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="truncate font-medium text-sm leading-5">{name}</div>
                        <span className="text-nowrap text-muted-foreground text-xs leading-5">
                          {formatDate(updatedAt)}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-end gap-2">
                        <div className="w-0 flex-1 overflow-hidden">
                          <div className="truncate font-medium text-foreground/90 text-xs leading-4">
                            {intention === "buy_now" ? "Buy Now" : "Inquiry"}
                          </div>
                          <div className="truncate text-muted-foreground text-xs capitalize leading-4">
                            {state.replace("_", " ")}
                          </div>
                        </div>
                        {unread > 0 && (
                          <div className="grid size-5 place-items-center rounded-full bg-primary/90 text-primary-foreground text-xs">
                            {unread > 99 ? "99+" : unread}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );

                const itemClass = cn(
                  "w-full overflow-hidden rounded-lg px-2.5 py-2.5 text-left ring-inset transition-colors",
                  selectedId === id ? "bg-muted ring-1 ring-border" : "hover:bg-muted/75",
                );

                if (onSelect) {
                  return (
                    <button
                      data-inquiry-id={id}
                      data-testid="inquiry-row"
                      key={id}
                      type="button"
                      className={itemClass}
                      onClick={() => onSelect(id)}
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <Link
                    data-inquiry-id={id}
                    data-testid="inquiry-row"
                    key={id}
                    href={`${baseUrl}/${id}`}
                    className={itemClass}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
