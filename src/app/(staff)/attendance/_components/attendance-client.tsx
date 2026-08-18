"use client";
"use no memo";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogIn,
  LogOut,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { checkAttendance, clockIn, clockOut } from "@/app/(staff)/attendance/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/validation/phase6";

const TIME_ZONE = "Asia/Manila";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  on_leave: "Leave",
};

const STATUS_STYLES: Record<AttendanceStatus, { className: string; variant: "default" | "destructive" | "outline" }> = {
  present: { variant: "default", className: "bg-emerald-500 text-white hover:bg-emerald-500/90" },
  late: { variant: "default", className: "bg-amber-500 text-white hover:bg-amber-500/90" },
  absent: { variant: "destructive", className: "bg-destructive text-destructive-foreground" },
  on_leave: { variant: "outline", className: "border-muted-foreground/40" },
  half_day: { variant: "default", className: "bg-sky-500 text-white hover:bg-sky-500/90" },
};

const attendanceStatusOptions = [
  { value: "all", label: "All" },
  ...ATTENDANCE_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];
const attendanceDateOptions = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;
const checkedOptions = [
  { value: "all", label: "All" },
  { value: "checked", label: "Checked" },
  { value: "unchecked", label: "Unchecked" },
] as const;
const attendanceSortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Employee A-Z" },
  { value: "name-desc", label: "Employee Z-A" },
] as const;

export interface AttendanceEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: AttendanceStatus;
  notes: string | null;
  checked_by: string | null;
}

export interface AttendanceState {
  serverNow: string;
  timeZone: typeof TIME_ZONE;
  timeZoneLabel: string;
  currentEntry: AttendanceEntry | null;
  scheduleLabel: string | null;
  graceMinutes: number | null;
  reason: string | null;
  isDataUnavailable?: boolean;
  clockIn: { allowed: boolean; reason: string | null };
  clockOut: { allowed: boolean; reason: string | null };
}

export interface AttendanceRealtimeAccess {
  attendanceEmployeeId: string | null | undefined;
  leaveEmployeeId: string | null | undefined;
  scheduleEmployeeId: string | null | undefined;
}

interface AttendanceClientProps {
  entries: AttendanceEntry[];
  canCheck: boolean;
  todayEntry: AttendanceEntry | null;
  attendanceState?: AttendanceState;
  realtimeEnabled?: boolean;
  realtimeAccess?: AttendanceRealtimeAccess;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00+08:00`),
  );
}

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.some((status) => status === value);
}

function statusBadge(status: AttendanceStatus) {
  const style = STATUS_STYLES[status];
  return (
    <Badge variant={style.variant} className={style.className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function defaultAttendanceState(todayEntry: AttendanceEntry | null): AttendanceState {
  return {
    serverNow: new Date().toISOString(),
    timeZone: TIME_ZONE,
    timeZoneLabel: "PHT / Asia/Manila",
    currentEntry: todayEntry,
    scheduleLabel: null,
    graceMinutes: null,
    reason: null,
    clockIn: { allowed: !todayEntry?.time_in, reason: null },
    clockOut: { allowed: Boolean(todayEntry?.time_in && !todayEntry.time_out), reason: null },
  };
}

function useServerClock(serverNow: string) {
  const startedAt = useRef({ server: Date.parse(serverNow), client: Date.now() });
  const [now, setNow] = useState(() => new Date(startedAt.current.server));

  useEffect(() => {
    startedAt.current = { server: Date.parse(serverNow), client: Date.now() };
    setNow(new Date(startedAt.current.server));
    const timer = window.setInterval(() => {
      setNow(new Date(startedAt.current.server + Date.now() - startedAt.current.client));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [serverNow]);

  return now;
}

function useAttendanceRealtime(enabled: boolean, access: AttendanceRealtimeAccess, refresh: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let channel = supabase.channel("attendance");
    const subscriptions = [
      ["attendance_entries", access.attendanceEmployeeId],
      ["employee_requests", access.leaveEmployeeId],
      ["employee_work_schedules", access.scheduleEmployeeId],
    ] as const;
    for (const [table, employeeId] of subscriptions) {
      if (employeeId === undefined) continue;
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(employeeId ? { filter: `employee_id=eq.${employeeId}` } : {}) },
        refresh,
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [access, enabled, refresh]);
}

export function AttendanceClient({
  entries,
  canCheck,
  todayEntry,
  attendanceState: providedState,
  realtimeEnabled = false,
  realtimeAccess,
}: AttendanceClientProps) {
  const router = useRouter();
  const attendanceState = providedState ?? defaultAttendanceState(todayEntry);
  const now = useServerClock(attendanceState.serverNow);
  const [loading, setLoading] = useState<string | null>(null);
  const [checkTarget, setCheckTarget] = useState<AttendanceEntry | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [notes, setNotes] = useState("");
  const [checkError, setCheckError] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "attendance_date", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnVisibility] = useState<VisibilityState>({
    search: false,
    attendanceWindow: false,
    checkedFilter: false,
  });

  const defaultRealtimeAccess = useMemo<AttendanceRealtimeAccess>(
    () => ({
      attendanceEmployeeId: canCheck ? null : attendanceState.currentEntry?.employee_id,
      leaveEmployeeId: canCheck ? null : attendanceState.currentEntry?.employee_id,
      scheduleEmployeeId: canCheck ? null : attendanceState.currentEntry?.employee_id,
    }),
    [attendanceState.currentEntry?.employee_id, canCheck],
  );
  useAttendanceRealtime(realtimeEnabled, realtimeAccess ?? defaultRealtimeAccess, router.refresh);

  async function runAction(
    action: () => Promise<{ error?: string } | { success?: boolean }>,
    key: string,
    successMessage: string,
  ) {
    setLoading(key);
    const result = await action();
    setLoading(null);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(successMessage);
    router.refresh();
  }

  async function submitCheck() {
    if (!checkTarget) return;
    setCheckError(null);
    const formData = new FormData();
    formData.set("id", checkTarget.id);
    formData.set("attendance_date", checkTarget.attendance_date);
    formData.set("status", status);
    formData.set("notes", notes);
    const result = await checkAttendance(formData);
    if ("error" in result && result.error) {
      setCheckError(result.error);
      return;
    }
    toast.success("Attendance record checked.");
    setCheckTarget(null);
    setNotes("");
    router.refresh();
  }

  const columns = useMemo<ColumnDef<AttendanceEntry>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all attendance on this page"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={`Select attendance ${row.original.id}`}
            />
          </div>
        ),
        enableHiding: false,
      },
      ...(canCheck
        ? [
            {
              accessorKey: "employee_name",
              header: "Employee",
              cell: ({ row }: { row: { original: AttendanceEntry } }) => (
                <span className="font-medium">{row.original.employee_name}</span>
              ),
            } satisfies ColumnDef<AttendanceEntry>,
          ]
        : []),
      {
        accessorKey: "attendance_date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.attendance_date),
      },
      {
        id: "search",
        accessorFn: (row) => `${row.id} ${row.employee_name} ${row.attendance_date} ${row.status} ${row.notes ?? ""}`,
        filterFn: "includesString",
        enableHiding: true,
      },
      {
        accessorKey: "time_in",
        header: "Time In",
        cell: ({ row }) => (row.original.time_in ? formatTime(row.original.time_in) : "—"),
      },
      {
        accessorKey: "time_out",
        header: "Time Out",
        cell: ({ row }) => (row.original.time_out ? formatTime(row.original.time_out) : "—"),
      },
      {
        accessorKey: "hours_worked",
        header: "Hours",
        cell: ({ row }) => (row.original.hours_worked === null ? "—" : `${row.original.hours_worked}h`),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: "checkedFilter",
        accessorFn: (row) => (row.checked_by ? "checked" : "unchecked"),
        filterFn: "equalsString",
        enableHiding: true,
      },
      {
        id: "attendanceWindow",
        accessorFn: (row) => {
          const daysSinceAttendance = Math.max(
            0,
            Math.round(
              (new Date().setHours(0, 0, 0, 0) - new Date(row.attendance_date).setHours(0, 0, 0, 0)) / 86_400_000,
            ),
          );
          if (daysSinceAttendance <= 30) return ["30", "90"];
          if (daysSinceAttendance <= 90) return ["90"];
          return [];
        },
        filterFn: "arrIncludes",
        enableHiding: true,
      },
      ...(canCheck
        ? [
            {
              id: "checked",
              header: "Checked",
              cell: ({ row }: { row: { original: AttendanceEntry } }) =>
                row.original.checked_by ? (
                  <Badge variant="secondary">Checked</Badge>
                ) : (
                  <Badge variant="outline">Unchecked</Badge>
                ),
            } satisfies ColumnDef<AttendanceEntry>,
          ]
        : []),
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Open attendance actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canCheck ? (
                <DropdownMenuItem
                  onClick={() => {
                    setCheckTarget(row.original);
                    setStatus(row.original.status);
                    setNotes(row.original.notes ?? "");
                    setCheckError(null);
                  }}
                >
                  <ShieldCheck data-icon="inline-start" />
                  Check attendance
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      } satisfies ColumnDef<AttendanceEntry>,
    ],
    [canCheck],
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { rowSelection, columnFilters, sorting, columnVisibility, pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const dateFilter = (table.getColumn("attendanceWindow")?.getFilterValue() as string) ?? "all";
  const checkedFilter = (table.getColumn("checkedFilter")?.getFilterValue() as string) ?? "all";
  const sortValue = useMemo(() => {
    const currentSort = sorting[0];
    if (!currentSort) return "newest";
    if (currentSort.id === "attendance_date" && currentSort.desc) return "newest";
    if (currentSort.id === "attendance_date" && !currentSort.desc) return "oldest";
    if (currentSort.id === "employee_name" && !currentSort.desc) return "name-asc";
    if (currentSort.id === "employee_name" && currentSort.desc) return "name-desc";
    return "newest";
  }, [sorting]);

  const clockLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: attendanceState.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="grid gap-4 text-center md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="md:justify-self-start md:text-left">
            <CardTitle>Today</CardTitle>
            <p className="text-muted-foreground text-sm">{attendanceState.scheduleLabel ?? "No schedule assigned."}</p>
          </div>
          <div className="justify-self-center text-center md:col-start-2 md:row-start-1">
            <p
              className="font-bold font-mono text-4xl tabular-nums leading-none tracking-tight sm:text-5xl md:text-6xl"
              data-testid="attendance-clock"
            >
              {clockLabel}
            </p>
            <p className="mt-2 font-medium text-muted-foreground text-sm">{attendanceState.timeZoneLabel}</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={
                attendanceState.currentEntry?.time_out
                  ? "secondary"
                  : attendanceState.currentEntry?.time_in
                    ? "default"
                    : "outline"
              }
            >
              {attendanceState.currentEntry?.time_out
                ? "Clocked out"
                : attendanceState.currentEntry?.time_in
                  ? "On duty"
                  : "Not clocked in"}
            </Badge>
            {attendanceState.graceMinutes !== null ? (
              <span className="text-muted-foreground text-sm">{attendanceState.graceMinutes}-minute grace period</span>
            ) : null}
            {attendanceState.currentEntry?.time_in ? (
              <span className="text-muted-foreground text-sm">
                In: {formatTime(attendanceState.currentEntry.time_in)}
              </span>
            ) : null}
            {attendanceState.currentEntry?.time_out ? (
              <span className="text-muted-foreground text-sm">
                Out: {formatTime(attendanceState.currentEntry.time_out)}
              </span>
            ) : null}
          </div>
          {attendanceState.reason ? <p className="text-muted-foreground text-sm">{attendanceState.reason}</p> : null}
          {attendanceState.isDataUnavailable ? (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => router.refresh()}>
              Refresh attendance
            </Button>
          ) : null}
          <div className="flex gap-2">
            <Button
              disabled={!attendanceState.clockIn.allowed || loading !== null}
              title={attendanceState.clockIn.reason ?? undefined}
              onClick={() => runAction(clockIn, "clock-in", "Clocked in.")}
            >
              <LogIn data-icon="inline-start" />
              {loading === "clock-in" ? "Clocking in..." : "Clock In"}
            </Button>
            <Button
              variant="outline"
              disabled={!attendanceState.clockOut.allowed || loading !== null}
              title={attendanceState.clockOut.reason ?? undefined}
              onClick={() => runAction(clockOut, "clock-out", "Clocked out.")}
            >
              <LogOut data-icon="inline-start" />
              {loading === "clock-out" ? "Clocking out..." : "Clock Out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{canCheck ? "All Records" : "My Attendance"}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                    placeholder="Search attendance..."
                    value={searchQuery}
                    onChange={(event) => {
                      table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                      table.setPageIndex(0);
                    }}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UsersRound />
                      Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-35" align="start">
                    <DropdownMenuRadioGroup
                      value={statusFilter}
                      onValueChange={(value) => {
                        table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
                        table.setPageIndex(0);
                      }}
                    >
                      {attendanceStatusOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarDays />
                      Attendance date
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-40" align="start">
                    <DropdownMenuRadioGroup
                      value={dateFilter}
                      onValueChange={(value) => {
                        table.getColumn("attendanceWindow")?.setFilterValue(value === "all" ? undefined : value);
                        table.setPageIndex(0);
                      }}
                    >
                      {attendanceDateOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UsersRound />
                      Checked
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={checkedFilter}
                      onValueChange={(value) => {
                        table.getColumn("checkedFilter")?.setFilterValue(value === "all" ? undefined : value);
                        table.setPageIndex(0);
                      }}
                    >
                      {checkedOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={sortValue}
                      onValueChange={(value) => {
                        const nextSorting: SortingState =
                          value === "oldest"
                            ? [{ id: "attendance_date", desc: false }]
                            : value === "name-asc"
                              ? [{ id: "employee_name", desc: false }]
                              : value === "name-desc"
                                ? [{ id: "employee_name", desc: true }]
                                : [{ id: "attendance_date", desc: true }];
                        table.setSorting(nextSorting);
                        table.setPageIndex(0);
                      }}
                    >
                      {attendanceSortOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader className="bg-muted/15">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan} className="h-11 p-3 font-medium">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="p-3 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
                selected.
              </div>
              <div className="flex w-full items-center gap-8 lg:w-fit">
                <div className="hidden items-center gap-2 lg:flex">
                  <Label htmlFor="attendance-rows-per-page" className="font-medium text-sm">
                    Rows per page
                  </Label>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => table.setPageSize(Number(value))}
                  >
                    <SelectTrigger size="sm" className="w-20" id="attendance-rows-per-page">
                      <SelectValue placeholder={table.getState().pagination.pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      <SelectGroup>
                        {[10, 20, 30, 40, 50].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center font-medium text-sm">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button
                    variant="outline"
                    className="hidden size-8 lg:flex"
                    size="icon"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-8"
                    size="icon"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-8"
                    size="icon"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden size-8 lg:flex"
                    size="icon"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={checkTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCheckTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check attendance</DialogTitle>
            {checkTarget ? <p className="text-muted-foreground text-sm">{checkTarget.employee_name}</p> : null}
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={status}
                onValueChange={(value) => {
                  if (isAttendanceStatus(value)) setStatus(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ATTENDANCE_STATUSES.map((attendanceStatus) => (
                      <SelectItem key={attendanceStatus} value={attendanceStatus}>
                        {STATUS_LABELS[attendanceStatus]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Optional notes..."
              />
            </Field>
            {checkError ? <p className="text-destructive text-sm">{checkError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCheckTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitCheck}>
              Save Check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
