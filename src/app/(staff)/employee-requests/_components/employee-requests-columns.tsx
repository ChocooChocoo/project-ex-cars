"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REQUEST_KINDS, type RequestKind } from "@/lib/validation/phase6";

const KIND_LABELS: Record<RequestKind, string> = {
  leave: "Leave",
  overtime: "Overtime",
  schedule_change: "Schedule Change",
  other: "Other",
};

const STATUS_STYLES: Record<
  EmployeeRequestRow["status"],
  { variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  approved: { variant: "default", className: "bg-emerald-500 text-white hover:bg-emerald-500/90" },
  rejected: { variant: "destructive", className: "bg-destructive text-destructive-foreground" },
  pending: { variant: "secondary", className: "bg-amber-500 text-white hover:bg-amber-500/90" },
  cancelled: { variant: "outline", className: "bg-muted text-muted-foreground" },
};

export interface EmployeeRequestRow {
  id: string;
  employee_id: string;
  request_kind: RequestKind;
  status: "pending" | "approved" | "rejected" | "cancelled";
  start_date: string;
  end_date: string | null;
  reason: string;
  review_notes: string | null;
  reviewed_at: string | null;
}

interface EmployeeRequestColumnOptions {
  canReview: boolean;
  onCancel: (requestId: string) => void;
  onReview: (request: EmployeeRequestRow) => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function statusBadge(status: EmployeeRequestRow["status"]) {
  const style = STATUS_STYLES[status];
  return (
    <Badge variant={style.variant} className={style.className}>
      {status}
    </Badge>
  );
}

export function createEmployeeRequestColumns({
  canReview,
  onCancel,
  onReview,
}: EmployeeRequestColumnOptions): ColumnDef<EmployeeRequestRow>[] {
  return [
    {
      accessorKey: "request_kind",
      header: "Type",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-muted-foreground" />
          {KIND_LABELS[row.original.request_kind]}
        </span>
      ),
    },
    {
      accessorKey: "start_date",
      header: "Start",
      cell: ({ row }) => formatDate(row.original.start_date),
    },
    {
      accessorKey: "end_date",
      header: "End",
      cell: ({ row }) => (row.original.end_date ? formatDate(row.original.end_date) : "—"),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => <span className="block max-w-64 truncate text-muted-foreground">{row.original.reason}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
    ...(canReview
      ? [
          {
            accessorKey: "reviewed_at",
            header: "Reviewed",
            cell: ({ row }: { row: { original: EmployeeRequestRow } }) =>
              row.original.reviewed_at ? formatDate(row.original.reviewed_at) : "—",
          } satisfies ColumnDef<EmployeeRequestRow>,
        ]
      : []),
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const request = row.original;
        if (canReview && request.status === "pending") {
          return (
            <Button variant="ghost" size="sm" onClick={() => onReview(request)}>
              <Check data-icon="inline-start" />
              Review
            </Button>
          );
        }
        if (!canReview && request.status === "pending") {
          return (
            <Button variant="ghost" size="sm" onClick={() => onCancel(request.id)}>
              <X data-icon="inline-start" />
              Cancel
            </Button>
          );
        }
        return null;
      },
    },
  ];
}

export { KIND_LABELS, REQUEST_KINDS, STATUS_STYLES };
