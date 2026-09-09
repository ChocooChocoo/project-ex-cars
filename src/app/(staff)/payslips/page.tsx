import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

import { type PayrollRunRow, PayslipsSummary } from "./_components/payslips-summary";
import { PayslipsTable, type PayslipTableRow } from "./_components/payslips-table";

export default async function PayslipsListPage() {
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  if (role === "head_accountant") {
    const { data: payslips } = await supabase
      .from("payslips")
      .select("*, payroll_runs(*)")
      .order("created_at", { ascending: false });

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
          <p className="text-muted-foreground text-sm">All employee payslips.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Payslips</CardTitle>
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

  if (["ceo", "account_manager"].includes(role)) {
    const [{ data: payrollRuns }, { data: ownPayslips }, { data: allPayslips }] = await Promise.all([
      supabase.from("payroll_runs").select("*").order("created_at", { ascending: false }).limit(20),
      supabase
        .from("payslips")
        .select("*, payroll_runs(*)")
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("payslips").select("*, payroll_runs(*)").order("created_at", { ascending: false }),
    ]);

    const mapRow = (p: Record<string, unknown>): PayslipTableRow => {
      const payrollRun = p.payroll_runs as Record<string, unknown>;
      return {
        id: String(p.id),
        period_start: String(payrollRun?.period_start ?? ""),
        period_end: String(payrollRun?.period_end ?? ""),
        gross_cents: Number(p.gross_cents ?? 0),
        net_cents: Number(p.net_cents ?? 0),
        status: String(p.status ?? "draft"),
        payment_status: String(p.payment_status ?? "pending"),
      };
    };

    const ownRows: PayslipTableRow[] = (ownPayslips ?? []).map((p) => mapRow(p as unknown as Record<string, unknown>));
    const allRows: PayslipTableRow[] = (allPayslips ?? []).map((p) => mapRow(p as unknown as Record<string, unknown>));
    const runs: PayrollRunRow[] = (payrollRuns ?? []).map((run) => ({
      id: String((run as Record<string, unknown>).id),
      period_start: String((run as Record<string, unknown>).period_start ?? ""),
      period_end: String((run as Record<string, unknown>).period_end ?? ""),
      status: String((run as Record<string, unknown>).status ?? "draft"),
      total_gross_cents: Number((run as Record<string, unknown>).total_gross_cents ?? 0),
      total_net_cents: Number((run as Record<string, unknown>).total_net_cents ?? 0),
    }));

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Payslips</h1>
          <p className="text-muted-foreground text-sm">Summary and your payslip. Full browse behind View all.</p>
        </div>

        <PayslipsSummary payrollRuns={runs} ownRows={ownRows} allRows={allRows} userId={user.id} />
      </div>
    );
  }

  const { data: payslips } = await supabase
    .from("payslips")
    .select("*, payroll_runs(*)")
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false });

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
        <p className="text-muted-foreground text-sm">Your payslip history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Payslips</CardTitle>
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
