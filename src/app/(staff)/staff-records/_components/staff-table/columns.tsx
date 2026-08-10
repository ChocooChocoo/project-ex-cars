"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { addMinutes, differenceInCalendarDays, endOfToday, format, parseISO } from "date-fns";
import { MoreHorizontal, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAFF_ROLES } from "@/lib/auth/roles";

import type { StaffTableRow } from "./schema";

export const WORKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
] as const;

export function isStaffAccount(account: StaffTableRow) {
  return (STAFF_ROLES as readonly string[]).includes(account.role ?? "");
}

export function formatSchedule(account: StaffTableRow) {
  if (!isStaffAccount(account) || !account.startTime || !account.endTime) return "—";
  const days = WORKDAYS.filter((day) => account.workdays?.includes(day.value))
    .map((day) => day.short)
    .join(", ");
  return `${days || "No workdays"} · ${account.startTime}–${account.endTime}`;
}

export function staffTableColumns(
  onEdit: (account: StaffTableRow) => void,
  onSetStatus: (account: StaffTableRow) => void,
): ColumnDef<StaffTableRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all staff on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.fullName ?? "Unnamed account"}`}
          />
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "name",
      accessorFn: (row) => row.fullName ?? "",
      header: "Staff",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
            <UserRound className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-sm leading-none">
                {row.original.fullName ?? "Unnamed account"}
              </span>
              <span className="truncate text-muted-foreground text-xs leading-none">
                #{row.original.id.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) => `${row.id} ${row.fullName ?? ""} ${row.role ?? ""}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "role",
      header: "Role",
      filterFn: "equalsString",
      cell: ({ row }) => <Badge variant="secondary">{row.original.role?.replace(/_/g, " ") ?? "Unassigned"}</Badge>,
    },
    {
      accessorKey: "accountState",
      header: "Status",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {row.original.accountState}
        </Badge>
      ),
    },
    {
      id: "schedule",
      header: "Schedule",
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{formatSchedule(row.original)}</span>,
    },
    {
      id: "joinedWindow",
      accessorFn: (row) => {
        const daysSinceJoined = differenceInCalendarDays(endOfToday(), parseISO(row.joined));

        if (daysSinceJoined <= 30) return ["30", "90"];
        if (daysSinceJoined <= 90) return ["90"];
        return [];
      },
      filterFn: "arrIncludes",
      enableHiding: true,
    },
    {
      accessorKey: "joined",
      header: "Joined",
      cell: ({ row }) => {
        const baseDate = parseISO(row.original.joined);
        // UUIDs aren't numeric like the template's ids, so hash the id into a stable 0-11 seed for the pseudo-time display.
        const seed = [...row.original.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 12;
        const joinedAt = addMinutes(baseDate, 9 * 60 + seed * 17);

        return (
          <div className="grid gap-0.5">
            <span className="text-sm">{format(joinedAt, "do MMMM yyyy")}</span>
            <span className="text-muted-foreground text-xs">at {format(joinedAt, "h:mm a")}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const account = row.original;
        const name = account.fullName ?? "this account";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(account)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSetStatus(account)}>Set Status</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
