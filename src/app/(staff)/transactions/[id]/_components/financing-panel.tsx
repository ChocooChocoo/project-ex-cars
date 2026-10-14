"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  completeFinancingAgreement,
  confirmFinancingTerms,
  proposeFinancingTerms,
  recordVehicleRecovered,
  recordVisitDecision,
  reviewFinancingTerms,
} from "@/app/(staff)/transactions/financing-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { missedInstallments } from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

const TERMS_STATE_LABELS: Record<string, string> = {
  proposed: "Waiting for the Head Accountant",
  ha_approved: "Waiting for the CEO",
  returned: "Returned for revision",
  approved: "Confirmed",
  active: "Active",
  completed: "Completed",
  rejected: "Rejected",
};

// §6 phases B–E on the transaction page: terms and approvals, the visit decision, the agreement,
// the account and recovery.
export function FinancingPanel({
  transactionId,
  state,
  flowStatus,
  terms,
  account,
  hasRecoveryCase,
  userRole,
  arrangementKind = "gce_visit",
  signingReported = false,
  threadId = null,
}: {
  readonly transactionId: string;
  readonly state: string;
  readonly flowStatus: string | null;
  readonly terms: Row | null;
  readonly account: Row | null;
  readonly hasRecoveryCase: boolean;
  readonly userRole: string;
  readonly arrangementKind?: string;
  readonly signingReported?: boolean;
  readonly threadId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const isSales = ["sales_manager", "ceo"].includes(userRole);
  const termsState = (terms?.state as string | undefined) ?? null;
  // A meet-up takes no downpayment; a delivery's fee and downpayment are approved with the terms.
  const meetup = arrangementKind === "meetup";
  const delivery = arrangementKind === "delivery";
  const termsReady =
    form.duration_months &&
    form.total_amount &&
    form.monthly_payment &&
    form.first_due_date &&
    form.missed_payment_policy?.trim() &&
    (meetup || form.down_payment) &&
    (!delivery || form.delivery_fee);
  // In the field the account opens once the Confidential Informant reports the signing.
  const canComplete =
    termsState === "approved" &&
    (meetup ? signingReported : flowStatus === "initial_dp_confirmed" && (!delivery || signingReported));
  const set = (key: string) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(action: (fd: FormData) => Promise<Result>, fields: Row, message: string) {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    for (const [key, value] of Object.entries(fields)) fd.set(key, String(value ?? ""));
    setBusy(true);
    const result = await action(fd);
    setBusy(false);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(message);
      setForm({});
      router.refresh();
    }
  }

  const installments = ((account?.installments as Row[] | undefined) ?? []) as {
    state: unknown;
    due_date: unknown;
    amount_due?: unknown;
  }[];
  const paid = installments.filter((i) => i.state === "paid").reduce((sum, i) => sum + Number(i.amount_due ?? 0), 0);
  const financed = account ? Number(account.opening_balance ?? 0) : 0;
  const missed = missedInstallments(installments);
  const remaining = Number(terms?.total_amount ?? 0) - Number(terms?.down_payment ?? 0);

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>In-House Financing</CardTitle>
        <CardDescription>
          The Sales Manager proposes the terms, the Head Accountant reviews them, the CEO confirms, and the buyer
          decides.{" "}
          {meetup
            ? "A meet-up takes no downpayment."
            : delivery
              ? "The delivery fee and the downpayment are paid before the car is dispatched."
              : "The Initial Downpayment is taken only after the buyer inspects the car."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {threadId ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/inquiries/${threadId}`}>Open chat with the buyer</Link>
            </Button>
            <span className="text-muted-foreground text-xs">
              Agree the instalment period and explain the financing offers before setting the terms.
            </span>
          </div>
        ) : null}
        {terms ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Financing terms</p>
              <Badge variant={termsState === "returned" ? "destructive" : "secondary"}>
                {TERMS_STATE_LABELS[termsState ?? ""] ?? termsState}
              </Badge>
            </div>
            <dl className="grid gap-2 sm:grid-cols-4">
              <Fact label="Vehicle price" value={formatCurrency(Number(terms.total_amount))} />
              <Fact label="Initial Downpayment" value={formatCurrency(Number(terms.down_payment))} />
              <Fact label="Balance" value={formatCurrency(remaining)} />
              <Fact
                label="Duration"
                value={`${String(terms.duration_months ?? terms.number_of_payments)} months · ${formatCurrency(Number(terms.monthly_payment ?? remaining / Number(terms.number_of_payments || 1)))}/mo`}
              />
              {terms.delivery_fee != null ? (
                <Fact label="Delivery fee" value={formatCurrency(Number(terms.delivery_fee))} />
              ) : null}
            </dl>
            {terms.missed_payment_policy ? (
              <p>
                <span className="text-muted-foreground">Missed payment policy: </span>
                {String(terms.missed_payment_policy)}
              </p>
            ) : null}
            {termsState === "returned" && terms.returned_reason ? (
              <p className="text-destructive text-xs">Returned: {String(terms.returned_reason)}</p>
            ) : null}
          </section>
        ) : null}

        {isSales && state === "approved" && (!terms || termsState === "returned") ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <p className="font-medium">{terms ? "Revise the terms" : "Propose the financing terms"}</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <Field
                id="fin-duration"
                label="Payment duration (months)"
                value={form.duration_months}
                onChange={set("duration_months")}
                type="number"
              />
              <Field
                id="fin-price"
                label="Vehicle price (₱)"
                value={form.total_amount}
                onChange={set("total_amount")}
                type="number"
              />
              {meetup ? null : (
                <Field
                  id="fin-dp"
                  label={delivery ? "Downpayment (₱)" : "Initial Downpayment (₱)"}
                  value={form.down_payment}
                  onChange={set("down_payment")}
                  type="number"
                />
              )}
              {delivery ? (
                <Field
                  id="fin-delivery-fee"
                  label="Delivery fee (₱)"
                  value={form.delivery_fee}
                  onChange={set("delivery_fee")}
                  type="number"
                />
              ) : null}
              <Field
                id="fin-monthly"
                label="Monthly payment (₱)"
                value={form.monthly_payment}
                onChange={set("monthly_payment")}
                type="number"
              />
              <Field
                id="fin-first-due"
                label="First installment due"
                value={form.first_due_date}
                onChange={set("first_due_date")}
                type="date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fin-missed-policy" className="text-xs">
                Missed payment policy
              </Label>
              <Textarea
                id="fin-missed-policy"
                rows={2}
                value={form.missed_payment_policy ?? ""}
                onChange={(e) => set("missed_payment_policy")(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="self-start"
              disabled={busy || !termsReady}
              onClick={() =>
                submit(
                  proposeFinancingTerms,
                  {
                    duration_months: form.duration_months,
                    total_amount: form.total_amount,
                    down_payment: form.down_payment,
                    delivery_fee: form.delivery_fee,
                    monthly_payment: form.monthly_payment,
                    first_due_date: form.first_due_date,
                    missed_payment_policy: form.missed_payment_policy,
                  },
                  "Terms sent to the Head Accountant.",
                )
              }
            >
              Send to Head Accountant
            </Button>
            {termsReady ? null : (
              <p className="text-muted-foreground text-xs">Fill in every field to send the terms.</p>
            )}
          </section>
        ) : null}

        {(userRole === "head_accountant" && termsState === "proposed") ||
        (userRole === "ceo" && termsState === "ha_approved") ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <p className="font-medium">{userRole === "ceo" ? "Confirm the financing" : "Review the financing"}</p>
            <Field id="fin-return-reason" label="Reason, if returning" value={form.reason} onChange={set("reason")} />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  userRole === "ceo"
                    ? submit(
                        confirmFinancingTerms,
                        { decision: "confirm" },
                        "Financing confirmed; the buyer is notified.",
                      )
                    : submit(reviewFinancingTerms, { decision: "approve" }, "Terms sent to the CEO.")
                }
              >
                {userRole === "ceo" ? "Confirm" : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  submit(
                    userRole === "ceo" ? confirmFinancingTerms : reviewFinancingTerms,
                    { decision: "return", reason: form.reason },
                    "Terms returned to the Sales Manager.",
                  )
                }
              >
                Return for revision
              </Button>
            </div>
          </section>
        ) : null}

        {isSales && !meetup && ["gce_visit_scheduled_dp_pending", "potential_buyer"].includes(flowStatus ?? "") ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <p className="font-medium">After the inspection</p>
            <p className="text-muted-foreground text-xs">
              A Purchase Claim reserves the car and moves to the Initial Downpayment. A Potential Buyer needs time; the
              car stays available to others.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => submit(recordVisitDecision, { decision: "claim" }, "Purchase Claim recorded.")}
              >
                Record Purchase Claim
              </Button>
              {flowStatus !== "potential_buyer" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => submit(recordVisitDecision, { decision: "potential" }, "Recorded as Potential Buyer.")}
                >
                  Needs time: Potential Buyer
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {flowStatus === "purchase_claim" ? (
          <p className="text-muted-foreground text-xs">
            Record the Initial Downpayment under Record payment, with "Payment for: Downpayment". The Head Accountant
            then verifies it.
          </p>
        ) : null}

        {["head_accountant", "ceo"].includes(userRole) && canComplete ? (
          <Button
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() => submit(completeFinancingAgreement, {}, "Financing account opened.")}
          >
            Complete financing agreement
          </Button>
        ) : null}

        {account ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Financing account</p>
              <div className="flex gap-2">
                {account.flagged_at ? <Badge variant="destructive">Flagged: missed payment</Badge> : null}
                <Badge variant="secondary" className="capitalize">
                  {String(account.state)}
                </Badge>
              </div>
            </div>
            <dl className="grid gap-2 sm:grid-cols-4">
              <Fact label="Amount financed" value={formatCurrency(financed)} />
              <Fact label="Paid" value={formatCurrency(paid)} />
              <Fact label="Remaining" value={formatCurrency(Math.max(0, financed - paid))} />
              <Fact label="Missed installments" value={String(missed)} />
            </dl>
            {userRole === "head_accountant" && hasRecoveryCase && flowStatus !== "repossessed" ? (
              <Button
                size="sm"
                variant="destructive"
                className="self-start"
                disabled={busy}
                onClick={() => submit(recordVehicleRecovered, {}, "Car recorded as recovered; reconditioning opened.")}
              >
                Record car recovered by GCE
              </Button>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
  readonly type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        min={type === "number" ? "0" : undefined}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
