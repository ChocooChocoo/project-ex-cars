"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { startOnlinePayment } from "@/app/(customer)/my-transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OnlinePayment as Due } from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

type PaymentRow = { payment_kind?: unknown; verified_by?: unknown };

// What the buyer pays through GCE's PayMongo link, and where each payment stands: not sent, sent and
// waiting for the Head Accountant, or verified.
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
  const [busy, setBusy] = useState(false);
  const rowFor = (kind: string) => payments.find((p) => p.payment_kind === kind);
  const unsent = due.filter((payment) => !rowFor(payment.kind));
  const total = unsent.reduce((sum, payment) => sum + payment.amount, 0);

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
      <ul className="flex flex-col divide-y rounded-md border text-sm">
        {due.map((payment) => {
          const row = rowFor(payment.kind);
          return (
            <li key={payment.kind} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                {payment.label} <span className="tabular-nums">{formatCurrency(payment.amount)}</span>
              </span>
              <Badge variant={row?.verified_by ? "secondary" : "outline"}>
                {row?.verified_by ? "Verified" : row ? "Sent, waiting for the Head Accountant" : "Not paid"}
              </Badge>
            </li>
          );
        })}
      </ul>
      {unsent.length > 0 ? (
        <>
          <Button className="self-start" disabled={busy} onClick={pay}>
            {busy ? "Opening PayMongo..." : `Pay ${formatCurrency(total)} with PayMongo`}
          </Button>
          <p className="text-muted-foreground text-xs">
            You pay on PayMongo. Enter exactly {formatCurrency(total)}. The Head Accountant checks the receipt and
            verifies your payment.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">
          The Head Accountant checks the PayMongo receipt and verifies each payment.
        </p>
      )}
    </section>
  );
}
