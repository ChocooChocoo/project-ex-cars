"use client";
"use no memo";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function TransactionPaymentProgressV1({
  kind,
  payments,
  purchaseDetails,
  sellDetails,
  vehicleRequests,
  installmentAccount,
}: {
  readonly kind: string;
  readonly payments: Record<string, unknown>[];
  readonly purchaseDetails: Record<string, unknown> | undefined;
  readonly sellDetails: Record<string, unknown> | undefined;
  readonly vehicleRequests: Record<string, unknown> | undefined;
  readonly installmentAccount: Record<string, unknown> | null;
}) {
  const total = purchaseDetails?.final_price ?? sellDetails?.offered_amount ?? vehicleRequests?.budget ?? null;
  const paid = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const remaining = total !== null ? Math.max(0, Number(total) - paid) : null;
  const insts = installmentAccount
    ? (((installmentAccount as Record<string, unknown>).installments as Record<string, unknown>[]) ?? [])
    : [];
  const totalNote = kind === "buy" ? "final price" : kind === "sell" ? "offered amount" : "customer budget";
  const remainingNote = insts.length > 0 ? `across ${insts.length} installment(s)` : "total minus paid";

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Payment Progress</CardTitle>
        <CardDescription>Monetary summary of this transaction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricChip
            label="Total Amount"
            value={total !== null ? formatCurrency(Number(total)) : "—"}
            note={totalNote}
          />
          <MetricChip label="Total Paid" value={formatCurrency(paid)} note={`${payments.length} payment record(s)`} />
          <MetricChip
            label="Remaining"
            value={remaining !== null ? formatCurrency(remaining) : "—"}
            note={remainingNote}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricChip({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border bg-muted/35 px-3 py-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-lg tabular-nums">{value}</div>
      <div className="text-muted-foreground text-xs">{note}</div>
    </div>
  );
}
