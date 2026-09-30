"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import {
  cancelUnpaidDelivery,
  createDeliveryFieldCase,
  relayDeliveryDelay,
  rescheduleDelivery,
  setDeliveryTerms,
} from "@/app/(staff)/transactions/delivery-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DELIVERY_STATUS_LABELS, type DeliveryStatus, verifiedPaid } from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Person = { id: string; full_name: string | null };
type Result = { error: string } | { success: true };

export interface DeliveryTeam {
  readonly informants: Person[];
  readonly mechanics: Person[];
  readonly headSecurity: Person[];
}

// §4 step 5 onward: terms, payments, the delivery team, tracking, delays and reschedules in one place.
export function DeliveryPanel({
  transactionId,
  state,
  purchaseDetails,
  payments,
  arrangement,
  fieldCase,
  team,
  userRole,
}: {
  readonly transactionId: string;
  readonly state: string;
  readonly purchaseDetails: Row | undefined;
  readonly payments: Row[];
  readonly arrangement: Row | null;
  readonly fieldCase: Row | null;
  readonly team: DeliveryTeam;
  readonly userRole: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (key: string) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const canManage = ["sales_manager", "ceo"].includes(userRole) && state === "approved";

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

  const paymentRows = payments as { payment_kind: unknown; amount: unknown; verified_by: unknown }[];
  const fee = Number(purchaseDetails?.delivery_fee ?? 0);
  const downpayment = Number(purchaseDetails?.downpayment_amount ?? 0);
  const feePaid = verifiedPaid(paymentRows, "delivery_fee");
  const downpaymentPaid = verifiedPaid(paymentRows, "downpayment");
  const dueAt = purchaseDetails?.downpayment_due_at as string | null;
  const termsSet = Boolean(dueAt);
  const deadlinePassed = Boolean(dueAt && new Date(dueAt).getTime() < Date.now() && downpaymentPaid < downpayment);
  const status = (fieldCase?.delivery_status as DeliveryStatus | null) ?? null;

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Delivery</CardTitle>
        <CardDescription>
          {arrangement
            ? `${format(new Date(arrangement.schedule as string), "MMM d, yyyy h:mm a")} · ${String(arrangement.location ?? "No address")}`
            : "No delivery date set."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {termsSet ? (
          <dl className="grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs">Delivery fee</dt>
              <dd>
                {formatCurrency(fee)} · {feePaid >= fee ? "verified" : "not verified"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Downpayment</dt>
              <dd>
                {formatCurrency(downpayment)} ·{" "}
                {purchaseDetails?.downpayment_forfeited_at
                  ? "forfeited"
                  : downpaymentPaid >= downpayment
                    ? "verified"
                    : "not verified"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Downpayment deadline</dt>
              <dd className={deadlinePassed ? "text-destructive" : undefined}>
                {dueAt ? format(new Date(dueAt), "MMM d, yyyy") : "—"}
              </dd>
            </div>
          </dl>
        ) : null}

        {canManage && !termsSet ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <p className="font-medium">Confirm the delivery</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Address serviceable?</Label>
                <Select value={form.serviceable ?? ""} onValueChange={set("serviceable")}>
                  <SelectTrigger aria-label="Address serviceable">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes, we can deliver</SelectItem>
                    <SelectItem value="no">No, not serviceable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.serviceable === "yes" ? (
                <>
                  <MoneyInput
                    id="delivery-fee"
                    label="Delivery fee (₱)"
                    value={form.delivery_fee}
                    onChange={set("delivery_fee")}
                  />
                  <MoneyInput
                    id="downpayment"
                    label="Downpayment (₱)"
                    value={form.downpayment_amount}
                    onChange={set("downpayment_amount")}
                  />
                </>
              ) : null}
            </div>
            <Button
              size="sm"
              className="self-start"
              variant={form.serviceable === "no" ? "destructive" : "default"}
              disabled={busy || !form.serviceable}
              onClick={() =>
                submit(
                  setDeliveryTerms,
                  {
                    serviceable: form.serviceable,
                    delivery_fee: form.delivery_fee,
                    downpayment_amount: form.downpayment_amount,
                  },
                  form.serviceable === "no" ? "Request closed: not serviceable." : "Delivery terms sent to the buyer.",
                )
              }
            >
              {form.serviceable === "no" ? "Reject: not serviceable" : "Confirm and notify buyer"}
            </Button>
          </section>
        ) : null}

        {canManage && deadlinePassed ? (
          <Button
            size="sm"
            variant="destructive"
            className="self-start"
            disabled={busy}
            onClick={() => submit(cancelUnpaidDelivery, {}, "Request cancelled.")}
          >
            Cancel: downpayment not paid
          </Button>
        ) : null}

        {canManage && termsSet && !fieldCase ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <p className="font-medium">Delivery team</p>
            {feePaid < fee ? (
              <p className="text-muted-foreground text-xs">
                Available once the Head Accountant verifies the delivery fee.
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <PersonSelect
                label="Confidential Informant"
                people={team.informants}
                value={form.informant_id}
                onChange={set("informant_id")}
              />
              <PersonSelect
                label="Mechanic"
                people={team.mechanics}
                value={form.mechanic_id}
                onChange={set("mechanic_id")}
              />
              <PersonSelect
                label="Head Security"
                people={team.headSecurity}
                value={form.head_security_id}
                onChange={set("head_security_id")}
              />
            </div>
            <Button
              size="sm"
              className="self-start"
              disabled={busy || feePaid < fee}
              onClick={() =>
                submit(
                  createDeliveryFieldCase,
                  {
                    informant_id: form.informant_id,
                    mechanic_id: form.mechanic_id,
                    head_security_id: form.head_security_id,
                  },
                  "Delivery field case created.",
                )
              }
            >
              Create delivery field case
            </Button>
          </section>
        ) : null}

        {fieldCase ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">Tracking</p>
              <Badge variant="secondary">{status ? DELIVERY_STATUS_LABELS[status] : "Not dispatched"}</Badge>
            </div>
            {fieldCase.delay_note ? (
              <p className="text-xs">
                Delay reported: {String(fieldCase.delay_note)}
                {fieldCase.expected_arrival
                  ? ` · expected ${format(new Date(fieldCase.expected_arrival as string), "MMM d, h:mm a")}`
                  : ""}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/field-cases/${fieldCase.id}`}>Open field case</Link>
              </Button>
              {canManage && fieldCase.delay_note ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => submit(relayDeliveryDelay, {}, "Buyer told about the delay.")}
                >
                  Tell the buyer about the delay
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {canManage && termsSet && status !== "delivered" ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <p className="font-medium">Reschedule or redirect (asked 5+ hours ahead)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-schedule" className="text-xs">
                  New date and time
                </Label>
                <Input
                  id="new-schedule"
                  type="datetime-local"
                  value={form.schedule ?? ""}
                  onChange={(e) => set("schedule")(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-address" className="text-xs">
                  Address
                </Label>
                <Input
                  id="new-address"
                  value={form.location ?? String(arrangement?.location ?? "")}
                  onChange={(e) => set("location")(e.target.value)}
                />
              </div>
              <MoneyInput id="reschedule-fee" label="Fee (₱)" value={form.fee} onChange={set("fee")} />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              disabled={busy}
              onClick={() =>
                submit(
                  rescheduleDelivery,
                  {
                    schedule: form.schedule ? new Date(form.schedule).toISOString() : "",
                    location: form.location ?? String(arrangement?.location ?? ""),
                    fee: form.fee ?? "0",
                  },
                  "Delivery rescheduled.",
                )
              }
            >
              Reschedule
            </Button>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MoneyInput({
  id,
  label,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} type="number" min="0" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PersonSelect({
  label,
  people,
  value,
  onChange,
}: {
  readonly label: string;
  readonly people: Person[];
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {people.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.full_name ?? person.id.slice(0, 8)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
