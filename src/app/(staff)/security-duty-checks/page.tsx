import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

import { type DutyCheckRow, SecurityDutyChecksClient } from "./_components/security-duty-checks-client";

export default async function SecurityDutyChecksPage() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "head_security"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const query = supabase.from("security_duty_checks").select("*").order("duty_date", { ascending: false });
  if (role === "head_security") {
    query.eq("security_id", user.id);
  }

  const { data: checks } = await query;
  const normalized = (checks as unknown as DutyCheckRow[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <SecurityComplianceStrip checks={normalized} />
      <SecurityDutyChecksClient checks={normalized} canManage={role === "head_security"} />
    </div>
  );
}

export function getSecuritySummary(checks: DutyCheckRow[], today: string) {
  const total = checks.length;
  const todayPending = checks.filter((check) => check.duty_date === today && check.status !== "completed").length;
  const missingEvidence = checks.filter((check) => !check.before_image_path || !check.after_image_path).length;
  const completed = checks.filter((check) => check.status === "completed").length;
  const pending = checks.filter((check) => check.status === "pending").length;
  return { total, todayPending, missingEvidence, completed, pending };
}

function SecurityComplianceStrip({ checks }: { readonly checks: DutyCheckRow[] }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const summary = getSecuritySummary(checks, today);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4" data-testid="security-compliance-strip">
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Total Checks</span>
          <span className="font-semibold text-2xl">{summary.total}</span>
          <Badge variant="secondary" className="w-fit">
            {summary.completed} completed
          </Badge>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Today Pending</span>
          <span className="font-semibold text-2xl">{summary.todayPending}</span>
          <Badge variant={summary.todayPending > 0 ? "default" : "secondary"} className="w-fit">
            due today
          </Badge>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Missing Evidence</span>
          <span className="font-semibold text-2xl">{summary.missingEvidence}</span>
          <Badge variant={summary.missingEvidence > 0 ? "destructive" : "secondary"} className="w-fit">
            before/after
          </Badge>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Pending</span>
          <span className="font-semibold text-2xl">{summary.pending}</span>
          <Badge variant="outline" className="w-fit">
            awaiting
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
