"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import { type DutyCheckRow, SecurityDutyChecksClient } from "./_components/security-duty-checks-client";

const DUTY_ROLES: GceRole[] = ["ceo", "head_security"];

export default function SecurityDutyChecksPage() {
  const allowed = useRequireRole(DUTY_ROLES);
  // Phase 7: Head Security reads and writes their own checks; the CEO reads all.
  const page = usePageData(allowed ? "security-duty-checks" : "security-duty-checks:denied", () =>
    allowed
      ? browserApi<{ canManage: boolean; checks: DutyCheckRow[] }>("GET", "/api/v1/staff/security-duty-checks")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const { checks, canManage } = page.data;

  return (
    <div className="flex flex-col gap-6">
      <SecurityComplianceStrip checks={checks} />
      <SecurityDutyChecksClient checks={checks} canManage={canManage} />
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
