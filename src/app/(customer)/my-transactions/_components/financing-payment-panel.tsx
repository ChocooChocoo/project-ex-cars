"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  advancedPaymentTotal,
  isOpenCheckout,
  nextUnpaidInstallment,
  paidInstallmentCount,
  paymentPurposeLabel,
  unpaidInstallments,
} from "@/lib/transactions/financing-payments";
import { paymentKindLabel } from "@/lib/transactions/labels";
import { formatCurrency } from "@/lib/utils";

import { startInstallmentCheckout } from "../actions";

type Row = Record<string, unknown>;
type Installment = Row & { state: unknown; due_date?: unknown; amount_due?: unknown };

export function FinancingPaymentPanel({
  transactionId,
  account,
  payments,
}: {
  readonly transactionId: string;
  readonly account: Row;
  readonly payments: Row[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"payment" | "advanced" | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const installments = (account.installments ?? []) as Installment[];
  const unpaid = unpaidInstallments(installments);
  const next = nextUnpaidInstallment(installments);
  // Every payment the buyer made (downpayment, delivery fee, installments), never an unpaid PayMongo session.
  const history = payments.filter((payment) => !isOpenCheckout(payment));
  const pendingIds = new Set(
    history
      .filter((payment) => {
        if (!payment.installment_id) return false;
        if (payment.verified_by || payment.rejected_at) return false;
        // An online session nobody paid is not a payment waiting for review.
        if (payment.payment_kind === "installment" && payment.method === "paymongo") {
          return Boolean(payment.paymongo_payment_id);
        }
        return true;
      })
      .map((payment) => payment.installment_id),
  );
  const available = unpaid.filter((installment) => !pendingIds.has(installment.id));
  const selected = available.filter((installment) => selectedIds.includes(String(installment.id)));
  const title = dialog === "advanced" ? "Advanced Payment" : "Payment";

  function open(value: "payment" | "advanced") {
    setSelectedIds([]);
    setFailure("");
    setDialog(value);
  }

  async function pay(advanced: boolean) {
    if (busy) return;
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    if (advanced) {
      fd.set("advanced", "yes");
      for (const id of selectedIds) fd.append("installment_ids", id);
    }
    setBusy(true);
    setFailure("");
    try {
      const result = await startInstallmentCheckout(fd);
      if ("error" in result) {
        const message = result.error ?? "Could not start the payment.";
        setFailure(message);
        toast.error(message);
        return;
      }
      if ("url" in result && result.url) {
        window.location.assign(result.url);
        return;
      }
      setDialog(null);
      router.refresh();
    } catch {
      setFailure("Could not start the payment. Try again.");
      toast.error("Could not start the payment. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Financing payments">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium tracking-tight">Financing payments</h2>
        <Badge variant="secondary">
          Paid {paidInstallmentCount(installments)} of {installments.length}
        </Badge>
      </div>
      {installments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No installment schedule yet.</p>
      ) : next ? (
        <p className="text-sm">
          Next due: {String(next.due_date)}, {formatCurrency(Number(next.amount_due))}
        </p>
      ) : (
        <p className="text-sm">Every installment is paid or waived.</p>
      )}
      {account.state === "active" && next ? (
        <>
          <p className="text-muted-foreground text-sm">
            Pay a bank transfer online through PayMongo. Pay cash at GCE and the Sales Manager records it. A payment
            counts only after the Head Accountant verifies it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={pendingIds.has(next.id)} onClick={() => open("payment")}>
              Payment
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={available.length === 0}
              onClick={() => open("advanced")}
            >
              Advanced Payment
            </Button>
          </div>
          {pendingIds.has(next.id) ? (
            <p className="text-muted-foreground text-sm">
              Your next installment is waiting for review. The Sales Manager approves online payments and the Head
              Accountant verifies them.
            </p>
          ) : null}
        </>
      ) : null}
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">Payment history</h3>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((payment) => (
              <li
                key={String(payment.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <span>
                  {paymentPurposeLabel(payment, installments, paymentKindLabel)} ·{" "}
                  {formatCurrency(Number(payment.amount))} ·{" "}
                  {payment.method === "paymongo"
                    ? "Bank transfer (PayMongo)"
                    : payment.method === "bank_transfer"
                      ? "Bank transfer"
                      : "Cash"}
                  {payment.settlement_date ? ` · ${String(payment.settlement_date)}` : ""}
                </span>
                <Badge variant={payment.rejected_at ? "destructive" : "outline"}>
                  {payment.rejected_at
                    ? "Rejected"
                    : payment.verified_by
                      ? "Verified"
                      : payment.payment_kind === "installment" && payment.method === "paymongo"
                        ? payment.approved_at
                          ? "Waiting for Head Accountant"
                          : payment.paymongo_payment_id
                            ? "Waiting for Sales Manager"
                            : "Waiting for PayMongo"
                        : "Pending verification"}
                </Badge>
                {payment.rejection_reason ? (
                  <p className="w-full break-words text-destructive">{String(payment.rejection_reason)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {dialog === "advanced"
                ? "Select whole unpaid installments to pay ahead. "
                : "Pay your next unpaid installment. "}
              You are sent to PayMongo for a bank transfer or e-wallet payment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {dialog === "advanced" ? (
              <fieldset className="flex flex-col gap-2" disabled={busy}>
                <legend className="mb-2 font-medium text-sm">Unpaid installments</legend>
                {unpaid.map((installment) => {
                  const id = String(installment.id);
                  return (
                    <label key={id} className="flex min-h-11 items-center gap-3 rounded-md border p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(id)}
                        disabled={pendingIds.has(id)}
                        onChange={(event) =>
                          setSelectedIds((ids) =>
                            event.target.checked ? [...ids, id] : ids.filter((value) => value !== id),
                          )
                        }
                      />
                      <span>
                        Installment {String(installment.sequence_no)} · {String(installment.due_date)} ·{" "}
                        {formatCurrency(Number(installment.amount_due))}
                        {pendingIds.has(id) ? " (Pending review)" : ""}
                      </span>
                    </label>
                  );
                })}
                <p className="font-medium text-sm" aria-live="polite">
                  Selected total: {formatCurrency(advancedPaymentTotal(selected))}
                </p>
              </fieldset>
            ) : (
              <p className="text-sm">Amount: {formatCurrency(Number(next?.amount_due ?? 0))}</p>
            )}
            {failure ? (
              <p role="alert" className="text-destructive text-sm">
                {failure}
              </p>
            ) : null}
            <Button
              className="min-h-11"
              type="button"
              disabled={busy || (dialog === "advanced" && selected.length === 0)}
              onClick={() => pay(dialog === "advanced")}
            >
              {busy ? "Opening PayMongo…" : "Pay online"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
