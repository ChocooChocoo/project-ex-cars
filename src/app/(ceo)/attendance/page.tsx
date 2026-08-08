import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function AttendancePage() {
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const isStaff = ["ceo", "account_manager", "head_accountant"].includes(role);
  const query = supabase
    .from("attendance_entries")
    .select("*")
    .order("attendance_date", { ascending: false })
    .limit(isStaff ? 100 : 30);
  if (!isStaff) {
    query.eq("employee_id", user.id);
  }

  const { data: entries } = await query;

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      present: "default",
      absent: "destructive",
      late: "secondary",
      half_day: "secondary",
      on_leave: "outline",
    };
    return <Badge variant={variants[status] ?? "secondary"}>{status}</Badge>;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Attendance</h1>
        <p className="text-muted-foreground text-sm">
          {isStaff ? "All employee attendance records." : "Your attendance history."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isStaff ? "All Records" : "My Attendance"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(entries ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No attendance records.
                  </TableCell>
                </TableRow>
              ) : (
                (entries ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.attendance_date as string).toLocaleDateString()}</TableCell>
                    <TableCell>{e.time_in ? new Date(e.time_in as string).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>{e.time_out ? new Date(e.time_out as string).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>{e.hours_worked ? `${e.hours_worked}h` : "—"}</TableCell>
                    <TableCell>{statusBadge(e.status as string)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
