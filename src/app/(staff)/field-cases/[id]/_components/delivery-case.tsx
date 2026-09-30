"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import { advanceDeliveryStatus, reportDeliveryDelay } from "@/app/(staff)/field-cases/delivery-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUSES,
  type DeliveryStatus,
  nextDeliveryStatus,
} from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;

// §4 steps 7–7b: the delivery team's view — who, where, what to collect, the status steps and delays.
export function DeliveryCase({
  fieldCase,
  transaction,
  userRole,
  userId,
}: {
  readonly fieldCase: Row;
  readonly transaction: Row;
  readonly userRole: string;
  readonly userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [delayNote, setDelayNote] = useState("");
  const [eta, setEta] = useState("");

  const buyer = transaction.profiles as Row | null;
  const vehicle = transaction.vehicles as Row | null;
  const detailsRaw = transaction.purchase_details as Row | Row[] | null;
  const details = Array.isArray(detailsRaw) ? detailsRaw[0] : detailsRaw;
  const status = (fieldCase.delivery_status as DeliveryStatus | null) ?? null;
  const next = nextDeliveryStatus(status);
  const onTeam = [
    fieldCase.assigned_confidential_informant,
    fieldCase.mechanic_id,
    fieldCase.head_security_id,
  ].includes(userId);
  const open = !["completed", "cancelled"].includes(fieldCase.state as string);
  const isInformant = userRole === "confidential_informant" && fieldCase.assigned_confidential_informant === userId;

  async function send(
    action: (fd: FormData) => Promise<{ error: string } | { success: true }>,
    fd: FormData,
    message: string,
  ) {
    fd.set("field_case_id", fieldCase.id as string);
    setBusy(true);
    const result = await action(fd);
    setBusy(false);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(message);
      router.refresh();
    }
  }

  const balance = Math.max(0, Number(details?.final_price ?? 0) - Number(details?.downpayment_amount ?? 0));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/field-cases" className="text-muted-foreground text-sm underline">
          Back to field cases
        </Link>
        <h1 className="text-3xl leading-none tracking-tight">Delivery</h1>
        <p className="text-muted-foreground text-sm">
          {fieldCase.schedule ? format(new Date(fieldCase.schedule as string), "MMM d, yyyy h:mm a") : "No schedule"} ·{" "}
          {String(fieldCase.location ?? "No address")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delivery pack</CardTitle>
            <CardDescription>Collect the remaining balance in cash when the buyer accepts the car.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Buyer: </span>
              {String(buyer?.full_name ?? "—")} {buyer?.phone ? `· ${buyer.phone}` : ""}
            </p>
            <p>
              <span className="text-muted-foreground">Vehicle: </span>
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.stock_code})` : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Downpayment paid: </span>
              {formatCurrency(Number(details?.downpayment_amount ?? 0))}
            </p>
            {details?.final_price ? (
              <p>
                <span className="text-muted-foreground">Balance to collect: </span>
                {formatCurrency(balance)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracking</CardTitle>
            <CardDescription>
              The buyer sees each step. Dispatch only after the downpayment is confirmed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <ol className="flex flex-wrap gap-2">
              {DELIVERY_STATUSES.map((step) => (
                <li key={step}>
                  <Badge
                    variant={
                      status && DELIVERY_STATUSES.indexOf(step) <= DELIVERY_STATUSES.indexOf(status)
                        ? "default"
                        : "outline"
                    }
                  >
                    {DELIVERY_STATUS_LABELS[step]}
                  </Badge>
                </li>
              ))}
            </ol>
            {onTeam && open && next ? (
              <Button
                size="sm"
                className="self-start"
                disabled={busy}
                onClick={() => send(advanceDeliveryStatus, new FormData(), `Marked ${DELIVERY_STATUS_LABELS[next]}.`)}
              >
                Mark {DELIVERY_STATUS_LABELS[next]}
              </Button>
            ) : null}
            {fieldCase.delay_note ? (
              <p className="text-xs">
                Delay reported: {String(fieldCase.delay_note)}
                {fieldCase.expected_arrival
                  ? ` · expected ${format(new Date(fieldCase.expected_arrival as string), "MMM d, h:mm a")}`
                  : ""}
              </p>
            ) : null}
            {isInformant && open && status !== "delivered" ? (
              <div className="flex flex-col gap-2 border-t pt-3">
                <Label htmlFor="delay-note">Report a delay to the Sales Manager</Label>
                <Textarea
                  id="delay-note"
                  rows={2}
                  value={delayNote}
                  onChange={(e) => setDelayNote(e.target.value)}
                  placeholder="e.g. Heavy traffic on SLEX"
                />
                <Label htmlFor="delay-eta">Expected arrival</Label>
                <Input id="delay-eta" type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} />
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  disabled={busy}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("delay_note", delayNote);
                    fd.set("expected_arrival", eta ? new Date(eta).toISOString() : "");
                    void send(reportDeliveryDelay, fd, "Delay reported.");
                  }}
                >
                  Report delay
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
