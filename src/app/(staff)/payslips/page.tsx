import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

import { PayslipsTable, type PayslipTableRow } from "./_components/payslips-table";

export default async function PayslipsListPage() {
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const isAuthorized = ["ceo", "account_manager", "head_accountant"].includes(role);
  const query = supabase.from("payslips").select("*, payroll_runs(*)").order("created_at", { ascending: false });
  if (!isAuthorized) query.eq("employee_id", user.id);

  const { data: payslips } = await query;
  const rows: PayslipTableRow[] = (payslips ?? []).map((p) => {
    const payrollRun = p.payroll_runs as Record<string, unknown>;
    return {
      id: String(p.id),
      period_start: String(payrollRun.period_start ?? ""),
      period_end: String(payrollRun.period_end ?? ""),
      gross_cents: Number(p.gross_cents ?? 0),
      net_cents: Number(p.net_cents ?? 0),
      status: String(p.status ?? "draft"),
      payment_status: String(p.payment_status ?? "pending"),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Payslips</h1>
        <p className="text-muted-foreground text-sm">
          {isAuthorized ? "All employee payslips." : "Your payslip history."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAuthorized ? "All Payslips" : "My Payslips"}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payslips available.</p>
          ) : (
            <PayslipsTable data={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
