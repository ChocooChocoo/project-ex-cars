"use client";
"use no memo";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { checkAttendance, clockIn, clockOut } from "@/app/(staff)/attendance/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [sorting, setSorting] = useState<SortingState>([{ id: "attendance_date", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

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
            {
              id: "actions",
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }: { row: { original: AttendanceEntry } }) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCheckTarget(row.original);
                    setStatus(row.original.status);
                    setNotes(row.original.notes ?? "");
                    setCheckError(null);
                  }}
                >
                  <ShieldCheck data-icon="inline-start" />
                  Check
                </Button>
              ),
            } satisfies ColumnDef<AttendanceEntry>,
          ]
        : []),
    ],
    [canCheck],
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting, pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
        <CardContent className="px-0 pb-0">
          <DataTable table={table} rowsPerPageId="attendance-rows-per-page" />
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
