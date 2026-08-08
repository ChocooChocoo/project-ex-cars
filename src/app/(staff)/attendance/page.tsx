import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

import { AttendanceClient, type AttendanceEntry } from "./_components/attendance-client";

const ATTENDANCE_CHECKERS = ["ceo", "account_manager", "head_accountant"];

export default async function AttendancePage() {
  await requireRole(STAFF_ROLES);
  const role = (await getCurrentRole()) as string;
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const isStaff = ATTENDANCE_CHECKERS.includes(role);
  const query = supabase
    .from("attendance_entries")
    .select("*")
    .order("attendance_date", { ascending: false })
    .limit(isStaff ? 100 : 30);
  if (!isStaff) {
    query.eq("employee_id", user.id);
  }

  const { data: entries } = await query;

  const today = new Date().toISOString().slice(0, 10);
  const typedEntries = (entries as unknown as AttendanceEntry[]) ?? [];
  const todayEntry = typedEntries.find(
    (entry) => entry.attendance_date === today && (entry as unknown as { employee_id: string }).employee_id === user.id,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Attendance</h1>
        <p className="text-muted-foreground text-sm">
          {isStaff ? "Clock in, clock out, and review employee attendance records." : "Your attendance history."}
        </p>
      </div>

      <AttendanceClient entries={typedEntries} canCheck={isStaff} todayEntry={todayEntry ?? null} />
    </div>
  );
}
