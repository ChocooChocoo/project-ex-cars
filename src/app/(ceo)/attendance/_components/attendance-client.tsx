"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { checkAttendance, clockIn, clockOut } from "@/app/(ceo)/attendance/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/validation/phase6";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  on_leave: "On Leave",
};

const STATUS_VARIANTS: Record<AttendanceStatus, "default" | "destructive" | "secondary" | "outline"> = {
  present: "default",
  absent: "destructive",
  late: "secondary",
  half_day: "secondary",
  on_leave: "outline",
};

interface AttendanceEntry {
  id: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: AttendanceStatus;
  notes: string | null;
  checked_by: string | null;
}

export type { AttendanceEntry };

interface AttendanceClientProps {
  entries: AttendanceEntry[];
  canCheck: boolean;
  todayEntry: AttendanceEntry | null;
}

export function AttendanceClient({ entries, canCheck, todayEntry }: AttendanceClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [checkTarget, setCheckTarget] = useState<AttendanceEntry | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [notes, setNotes] = useState("");
  const [checkError, setCheckError] = useState<string | null>(null);

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
    } else {
      toast.success(successMessage);
      router.refresh();
    }
  }

  async function submitCheck() {
    if (!checkTarget) return;
    setCheckError(null);
    const fd = new FormData();
    fd.set("id", checkTarget.id);
    fd.set("attendance_date", checkTarget.attendance_date);
    fd.set("status", status);
    fd.set("notes", notes);
    const result = await checkAttendance(fd);
    if ("error" in result && result.error) {
      setCheckError(result.error);
      return;
    }
    toast.success("Attendance record checked.");
    setCheckTarget(null);
    setNotes("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={todayEntry?.time_out ? "secondary" : todayEntry?.time_in ? "default" : "outline"}>
              {todayEntry?.time_out ? "Clocked out" : todayEntry?.time_in ? "On duty" : "Not clocked in"}
            </Badge>
            {todayEntry?.time_in ? (
              <span className="text-muted-foreground text-sm">
                In: {new Date(todayEntry.time_in).toLocaleTimeString()}
              </span>
            ) : null}
            {todayEntry?.time_out ? (
              <span className="text-muted-foreground text-sm">
                Out: {new Date(todayEntry.time_out).toLocaleTimeString()}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!!todayEntry?.time_in || loading !== null}
              onClick={() => runAction(clockIn, "clock-in", "Clocked in.")}
            >
              <LogIn data-icon="inline-start" />
              {loading === "clock-in" ? "Clocking in..." : "Clock In"}
            </Button>
            <Button
              variant="outline"
              disabled={!todayEntry?.time_in || !!todayEntry?.time_out || loading !== null}
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
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Time In</th>
                  <th className="px-2 py-2 font-medium">Time Out</th>
                  <th className="px-2 py-2 font-medium">Hours</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  {canCheck ? <th className="px-2 py-2 font-medium">Checked</th> : null}
                  {canCheck ? <th className="px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={canCheck ? 7 : 5} className="px-2 py-6 text-center text-muted-foreground">
                      No attendance records.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="px-2 py-2">{new Date(entry.attendance_date).toLocaleDateString()}</td>
                      <td className="px-2 py-2">
                        {entry.time_in ? new Date(entry.time_in).toLocaleTimeString() : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {entry.time_out ? new Date(entry.time_out).toLocaleTimeString() : "—"}
                      </td>
                      <td className="px-2 py-2">{entry.hours_worked !== null ? `${entry.hours_worked}h` : "—"}</td>
                      <td className="px-2 py-2">
                        <Badge variant={STATUS_VARIANTS[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
                      </td>
                      {canCheck ? (
                        <td className="px-2 py-2">
                          {entry.checked_by ? (
                            <Badge variant="secondary">Checked</Badge>
                          ) : (
                            <Badge variant="outline">Unchecked</Badge>
                          )}
                        </td>
                      ) : null}
                      {canCheck ? (
                        <td className="px-2 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCheckTarget(entry);
                              setStatus(entry.status);
                              setNotes(entry.notes ?? "");
                              setCheckError(null);
                            }}
                          >
                            <ShieldCheck data-icon="inline-start" />
                            Check
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ATTENDANCE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
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
                onChange={(e) => setNotes(e.target.value)}
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
