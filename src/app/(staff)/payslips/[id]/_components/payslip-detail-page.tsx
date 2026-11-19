"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { useRouteParam } from "@/lib/routing/use-route-param";

import { PayslipDetailClient, type PayslipItemRow } from "./payslip-detail-client";

interface PayslipData {
  role: string;
  isEmployee: boolean;
  payslip: {
    id: string;
    employee_id: string;
    status: "draft" | "finalized";
    payment_status: "pending" | "paid";
    gross_cents: number;
    deductions_cents: number;
    net_cents: number;
    period_start: string | null;
    period_end: string | null;
  };
  items: (PayslipItemRow & { source_value: string | null })[];
}

export function PayslipDetailPage() {
  const id = useRouteParam("payslips");
  const allowed = useRequireRole(STAFF_ROLES);
  // Phase 7: Laravel returns the payslip only to its employee (once finalized) or to CEO/AM/HA; otherwise 404.
  const page = usePageData(allowed && id ? `payslip:${id}` : "payslip:none", () =>
    allowed && id
      ? browserApi<PayslipData>("GET", `/api/v1/staff/payslips/${id}`).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        })
      : Promise.resolve(undefined),
  );
  if (page.error) throw page.error;
  if (!allowed || !id || page.data === undefined) return <PageSkeleton />;
  if (page.data === null) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-semibold text-3xl tracking-tight">Payslip Not Found</h1>
      </div>
    );
  }
  const { role, isEmployee, payslip, items } = page.data;

  const earnings = items.filter((i) => i.item_kind === "earning");
  const deductions = items.filter((i) => i.item_kind === "deduction");
  // Hours payslips (Phase 8) carry the hours in source_value; older day-based payslips have no such item.
  const hoursOf = (label: string) => {
    const item = earnings.find((i) => i.label === label);
    return item ? Number(item.source_value) : null;
  };
  const regularHours = hoursOf("Regular hours");
  const periodLabel =
    payslip.period_start && payslip.period_end
      ? `${new Date(payslip.period_start).toLocaleDateString()} — ${new Date(payslip.period_end).toLocaleDateString()}`
      : "No period";

  return (
    <div className="flex w-full flex-col gap-6">
      <PayslipDetailClient
        payslipId={payslip.id}
        status={payslip.status}
        paymentStatus={payslip.payment_status}
        grossCents={payslip.gross_cents}
        deductionsCents={payslip.deductions_cents}
        netCents={payslip.net_cents}
        earnings={earnings}
        deductions={deductions}
        hours={regularHours === null ? null : { regular: regularHours, overtime: hoursOf("Overtime hours") ?? 0 }}
        canEdit={["ceo", "account_manager"].includes(role)}
        canPay={role === "head_accountant"}
        periodLabel={periodLabel}
        employeeLabel={isEmployee ? "You" : payslip.employee_id.slice(0, 8)}
      />
    </div>
  );
}
