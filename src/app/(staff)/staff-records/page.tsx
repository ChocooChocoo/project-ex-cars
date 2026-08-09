import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

import { type PerformanceReviewRow, PerformanceReviews } from "./_components/performance-reviews";
import { type StaffRecordAccount, StaffRecordsTable } from "./_components/staff-records-table";
import { WalkInForm } from "./_components/walk-in-form";

export default async function StaffRecordsPage() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });

  const { data: roles, error: rolesError } = await supabase.rpc("get_all_user_roles");
  const { data: schedules, error: schedulesError } = await supabase
    .from("employee_work_schedules")
    .select("employee_id, workdays, start_time, end_time, grace_minutes");

  const roleMap = new Map<string, string>();
  for (const r of (roles as { account_id: string; role: string }[]) ?? []) {
    roleMap.set(r.account_id, r.role);
  }

  const staffRoleIds = (roles as { account_id: string; role: string }[] | null)
    ?.filter((r) => (STAFF_ROLES as readonly string[]).includes(r.role))
    .map((r) => r.account_id);

  const staffProfiles = (profiles ?? []).filter((p) => staffRoleIds?.includes(p.id as string));
  const employeeOptions = staffProfiles.map((p) => ({ id: p.id as string, full_name: p.full_name as string | null }));
  const accounts: StaffRecordAccount[] = (profiles ?? []).map((profile) => {
    const schedule = (schedules as Record<string, unknown>[] | null)?.find((item) => item.employee_id === profile.id);
    const workdays = schedule?.workdays;
    return {
      id: profile.id as string,
      fullName: (profile.full_name as string | null) ?? null,
      phone: (profile.phone as string | null) ?? null,
      address: (profile.address as string | null) ?? null,
      role: roleMap.get(profile.id as string) ?? null,
      accountState: profile.account_state as string,
      workdays: Array.isArray(workdays) ? workdays.filter((day): day is number => typeof day === "number") : null,
      startTime: typeof schedule?.start_time === "string" ? schedule.start_time : null,
      endTime: typeof schedule?.end_time === "string" ? schedule.end_time : null,
      graceMinutes: typeof schedule?.grace_minutes === "number" ? schedule.grace_minutes : null,
    };
  });

  const { data: reviews, error: reviewsError } = await supabase
    .from("performance_reviews")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  const recordsError = profilesError ?? rolesError ?? schedulesError;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Staff Records</h1>
          <p className="text-muted-foreground text-sm">Manage employee and customer accounts.</p>
        </div>
        <WalkInForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {recordsError ? (
            <p role="alert" className="px-6 py-4 text-destructive text-sm">
              Staff records are temporarily unavailable. Please refresh and try again.
            </p>
          ) : (
            <StaffRecordsTable accounts={accounts} />
          )}
        </CardContent>
      </Card>

      {reviewsError ? (
        <Card>
          <CardHeader>
            <CardTitle>Performance Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <p role="alert" className="text-destructive text-sm">
              Performance reviews are temporarily unavailable. Please refresh and try again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <PerformanceReviews
          reviews={(reviews as unknown as PerformanceReviewRow[]) ?? []}
          employees={employeeOptions}
          canManage={["ceo", "account_manager"].includes(role)}
        />
      )}
    </div>
  );
}
