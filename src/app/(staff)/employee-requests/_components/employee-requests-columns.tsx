"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Check, MoreHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  approved: {
    variant: "outline",
    className: "border-green-600/50 text-green-700 dark:border-green-500/40 dark:text-green-400",
  },
  rejected: {
    variant: "outline",
    className: "border-red-600/50 text-red-700 dark:border-red-500/40 dark:text-red-400",
  },
  pending: {
    variant: "outline",
    className: "border-yellow-600/50 text-yellow-700 dark:border-yellow-500/40 dark:text-yellow-400",
  },
  cancelled: {
    variant: "outline",
    className: "border-slate-400/50 text-slate-600 dark:border-slate-500/50 dark:text-slate-400",
  },
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
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all employee requests on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select request ${row.original.id}`}
          />
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) =>
        `${row.id} ${row.request_kind} ${row.status} ${row.reason} ${row.start_date} ${row.end_date ?? ""}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      id: "startWindow",
      accessorFn: (row) => {
        const daysSinceStart = Math.max(
          0,
          Math.round((new Date().setHours(0, 0, 0, 0) - new Date(row.start_date).setHours(0, 0, 0, 0)) / 86_400_000),
        );
        if (daysSinceStart <= 30) return ["30", "90"];
        if (daysSinceStart <= 90) return ["90"];
        return [];
      },
      filterFn: "arrIncludes",
      enableHiding: true,
    },
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
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Open request actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canReview && request.status === "pending" ? (
                <DropdownMenuItem onClick={() => onReview(request)}>
                  <Check data-icon="inline-start" />
                  Review request
                </DropdownMenuItem>
              ) : !canReview && request.status === "pending" ? (
                <DropdownMenuItem variant="destructive" onClick={() => onCancel(request.id)}>
                  <X data-icon="inline-start" />
                  Cancel request
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

export { KIND_LABELS, REQUEST_KINDS, STATUS_STYLES };
