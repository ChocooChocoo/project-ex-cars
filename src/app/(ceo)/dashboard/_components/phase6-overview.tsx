import { Banknote, BriefcaseBusiness, CalendarClock, FileCheck2, Megaphone, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

export async function Phase6Overview() {
  const supabase = await createServerSupabase();

  const [
    { count: attendanceToday },
    { count: pendingRequests },
    { count: pendingRuns },
    { count: openCases },
    { count: activeDisbursements },
    { count: publishedAnnouncements },
  ] = await Promise.all([
    supabase
      .from("attendance_entries")
      .select("id", { count: "exact", head: true })
      .eq("attendance_date", new Date().toISOString().slice(0, 10)),
    supabase.from("employee_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("payroll_runs")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "pending_approval", "approved"]),
    supabase.from("field_cases").select("id", { count: "exact", head: true }).neq("state", "completed"),
    supabase
      .from("disbursement_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "approved", "released", "received"]),
    supabase.from("announcements").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);

  const metrics = [
    {
      label: "Attendance Today",
      value: attendanceToday ?? 0,
      icon: CalendarClock,
      href: "/dashboard/attendance",
    },
    {
      label: "Pending Requests",
      value: pendingRequests ?? 0,
      icon: Users,
      href: "/dashboard/employee-requests",
    },
    {
      label: "Active Payroll Runs",
      value: pendingRuns ?? 0,
      icon: BriefcaseBusiness,
      href: "/dashboard/payroll",
    },
    {
      label: "Open Field Cases",
      value: openCases ?? 0,
      icon: FileCheck2,
      href: "/dashboard/field-cases",
    },
    {
      label: "Active Disbursements",
      value: activeDisbursements ?? 0,
      icon: Banknote,
      href: "/dashboard/finance",
    },
    {
      label: "Published Announcements",
      value: publishedAnnouncements ?? 0,
      icon: Megaphone,
      href: "/dashboard/announcements",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-3 dark:*:data-[slot=card]:bg-card">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
              </CardTitle>
              <CardDescription>{metric.label}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{metric.value}</div>
                <Badge variant="secondary" className="rounded-md">
                  <a href={metric.href} className="hover:underline">
                    View →
                  </a>
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">Live from platform records</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
