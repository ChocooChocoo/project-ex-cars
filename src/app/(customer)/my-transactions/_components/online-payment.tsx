"use client";

import { useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { toast } from "sonner";

import { startOnlinePayment } from "@/app/(customer)/my-transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OnlinePayment as Due } from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

type PaymentRow = { payment_kind?: unknown; verified_by?: unknown };

// What the buyer pays on PayMongo Checkout, and where each payment stands: not paid, waiting for PayMongo
// to confirm, or paid. PayMongo's webhook marks a payment paid.
export function OnlinePayment({
  transactionId,
  due,
  payments,
}: {
  readonly transactionId: string;
  readonly due: Due[];
  readonly payments: PaymentRow[];
}) {
  const router = useRouter();
  const returned = useSearchParams();
  const [busy, setBusy] = useState(false);
  const rowFor = (kind: string) => payments.find((p) => p.payment_kind === kind);
  // Not paid yet: never started, or started on a Checkout the buyer left. Pay reopens or replaces it.
  const unpaid = due.filter((payment) => !rowFor(payment.kind)?.verified_by);
  const total = unpaid.reduce((sum, payment) => sum + payment.amount, 0);

  async function pay() {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    setBusy(true);
    const result = await startOnlinePayment(fd);
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
    window.location.assign(result.url);
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="online-payment-heading">
      <h2 id="online-payment-heading" className="font-medium tracking-tight">
        Pay online
      </h2>
      {returned.get("paid") ? (
        <p role="status" className="text-sm">
          Payment received. It shows as Paid once PayMongo confirms it.
        </p>
      ) : returned.get("cancelled") ? (
        <p role="status" className="text-sm">
          Payment cancelled. Nothing was charged.
        </p>
      ) : null}
      <ul className="flex flex-col divide-y rounded-md border text-sm">
        {due.map((payment) => {
          const row = rowFor(payment.kind);
          return (
            <li key={payment.kind} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                {payment.label} <span className="tabular-nums">{formatCurrency(payment.amount)}</span>
              </span>
              <Badge variant={row?.verified_by ? "secondary" : "outline"}>
                {row?.verified_by ? "Paid" : row ? "Waiting for PayMongo" : "Not paid"}
              </Badge>
            </li>
          );
        })}
      </ul>
      {unpaid.length > 0 ? (
        <>
          <Button className="self-start" disabled={busy} onClick={pay}>
            {busy ? "Opening PayMongo..." : `Pay ${formatCurrency(total)} with PayMongo`}
          </Button>
          <p className="text-muted-foreground text-xs">
            You pay on PayMongo by card, GCash, Maya or online banking. Your payment is confirmed automatically.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">PayMongo confirms each payment; this page updates when it does.</p>
      )}
    </section>
  );
}
