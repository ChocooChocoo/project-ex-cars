import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { PayslipDetailClient, type PayslipItemRow } from "./_components/payslip-detail-client";

export default async function PayslipDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const { data: payslip } = await supabase.from("payslips").select("*, payroll_runs(*)").eq("id", id).single();

  if (!payslip) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-semibold text-3xl tracking-tight">Payslip Not Found</h1>
      </div>
    );
  }

  const isEmployee = payslip.employee_id === user.id;
  const isAuthorized = ["ceo", "account_manager", "head_accountant"].includes(role);
  if (!isEmployee && !isAuthorized) redirect("/unauthorized");

  const { data: items } = await supabase.from("payslip_items").select("*").eq("payslip_id", id);

  const earnings = (items ?? []).filter((i) => i.item_kind === "earning");
  const deductions = (items ?? []).filter((i) => i.item_kind === "deduction");

  const payrollRun = payslip.payroll_runs as Record<string, unknown> | null;
  const periodLabel = payrollRun
    ? `${new Date(payrollRun.period_start as string).toLocaleDateString()} — ${new Date(payrollRun.period_end as string).toLocaleDateString()}`
    : "No period";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PayslipDetailClient
        payslipId={id}
        status={(payslip.status as "draft" | "finalized") ?? "draft"}
        grossCents={(payslip.gross_cents as number) ?? 0}
        deductionsCents={(payslip.deductions_cents as number) ?? 0}
        netCents={(payslip.net_cents as number) ?? 0}
        earnings={(earnings as unknown as PayslipItemRow[]) ?? []}
        deductions={(deductions as unknown as PayslipItemRow[]) ?? []}
        canEdit={["ceo", "account_manager"].includes(role)}
        periodLabel={periodLabel}
        employeeLabel={isEmployee ? "You" : (payslip.employee_id as string).slice(0, 8)}
      />
    </div>
  );
}
