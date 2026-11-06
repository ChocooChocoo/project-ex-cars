"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  advancedPaymentTotal,
  nextUnpaidInstallment,
  paidInstallmentCount,
  unpaidInstallments,
} from "@/lib/transactions/financing-payments";
import { formatCurrency } from "@/lib/utils";

import { submitAdvancedPayment, submitFinancingPayment } from "../actions";

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
  const [method, setMethod] = useState("cash");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const installments = (account.installments ?? []) as Installment[];
  const unpaid = unpaidInstallments(installments);
  const next = nextUnpaidInstallment(installments);
  const history = payments.filter((payment) => payment.installment_id);
  const pendingIds = new Set(
    history.filter((payment) => !payment.verified_by && !payment.rejected_at).map((payment) => payment.installment_id),
  );
  const available = unpaid.filter((installment) => !pendingIds.has(installment.id));
  const selected = available.filter((installment) => selectedIds.includes(String(installment.id)));
  const title = dialog === "advanced" ? "Advanced Payment" : "Payment";

  function open(value: "payment" | "advanced") {
    setMethod("cash");
    setSelectedIds([]);
    setFailure("");
    setDialog(value);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fd = new FormData(event.currentTarget);
    fd.set("transaction_id", transactionId);
    for (const id of selectedIds) fd.append("installment_ids", id);
    setBusy(true);
    setFailure("");
    try {
      const result = await (dialog === "advanced" ? submitAdvancedPayment(fd) : submitFinancingPayment(fd));
      if ("error" in result) {
        const message = result.error ?? "Could not submit the payment.";
        setFailure(message);
        toast.error(message);
      } else {
        toast.success("Payment submitted for Head Accountant verification.");
        setDialog(null);
        router.refresh();
      }
    } catch {
      setFailure("Could not submit the payment. Try again.");
      toast.error("Could not submit the payment. Try again.");
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
            Submit cash payments or bank-transfer proof here. Payments count only after the Head Accountant verifies
            them.
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
              Your next installment is awaiting Head Accountant verification.
            </p>
          ) : null}
        </>
      ) : null}
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">Payment history</h3>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">No installment payments submitted yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((payment) => (
              <li
                key={String(payment.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <span>
                  {formatCurrency(Number(payment.amount))} ·{" "}
                  {payment.method === "bank_transfer" ? "Bank transfer" : "Cash"}
                  {payment.settlement_date ? ` · ${String(payment.settlement_date)}` : ""}
                </span>
                <Badge variant={payment.rejected_at ? "destructive" : "outline"}>
                  {payment.rejected_at ? "Rejected" : payment.verified_by ? "Verified" : "Pending verification"}
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
                ? "Select whole unpaid installments to pay ahead."
                : "Pay your next unpaid installment."}{" "}
              The Head Accountant verifies your submission.
            </DialogDescription>
          </DialogHeader>
          <form aria-label={title} onSubmit={submit} className="flex flex-col gap-4">
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
                        {pendingIds.has(id) ? " (Pending verification)" : ""}
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="financing-payment-method">Payment method</Label>
              <select
                id="financing-payment-method"
                name="method"
                value={method}
                disabled={busy}
                onChange={(event) => setMethod(event.target.value)}
                className="min-h-11 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="financing-payment-proof">
                Payment proof ({method === "bank_transfer" ? "required" : "optional"})
              </Label>
              <Input
                id="financing-payment-proof"
                name="proof"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={method === "bank_transfer"}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="financing-payment-reference">Reference (optional)</Label>
              <Input id="financing-payment-reference" name="external_reference" maxLength={100} disabled={busy} />
            </div>
            {failure ? (
              <p role="alert" className="text-destructive text-sm">
                {failure}
              </p>
            ) : null}
            <Button
              className="min-h-11"
              type="submit"
              disabled={busy || (dialog === "advanced" && selected.length === 0)}
            >
              {busy ? "Submitting…" : "Submit payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
