"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { Calendar, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";

import { cancelTransaction, saveBuyDetails } from "@/app/(customer)/my-transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileAutoFill } from "@/lib/autofill";
import {
  arrangementKindLabel,
  paymentMethodLabel,
  TRANSACTION_STATE_LABELS,
  transactionKindLabel,
  transactionStatusBadgeVariant,
} from "@/lib/transactions/labels";
import type { TransactionState } from "@/lib/transactions/state-machine";
import { formatCurrency } from "@/lib/utils";

export function TransactionDetail({
  transaction,
  history,
  documents,
  payments,
  installmentAccount,
  paymentTerms,
  viewingArrangements,
  autofill,
}: {
  readonly transaction: Record<string, unknown>;
  readonly history: Record<string, unknown>[];
  readonly documents: Record<string, unknown>[];
  readonly payments: Record<string, unknown>[];
  readonly installmentAccount: Record<string, unknown> | null;
  readonly paymentTerms: Record<string, unknown> | null;
  readonly viewingArrangements: Record<string, unknown>[];
  readonly autofill: ProfileAutoFill | null;
}) {
  const router = useRouter();
  const id = transaction.id as string;
  const kind = transaction.transaction_kind as string;
  const state = (transaction.current_state ?? "pending") as TransactionState;
  const vehicles = transaction.vehicles as Record<string, unknown> | undefined;
  const purchaseDetails = transaction.purchase_details as Record<string, unknown> | undefined;
  const sellDetails = transaction.sell_details as Record<string, unknown> | undefined;
  const vehicleRequests = transaction.vehicle_requests as Record<string, unknown> | undefined;
  const openedAt = transaction.opened_at as string;
  const completedAt = transaction.completed_at as string | null;

  const [cancelling, setCancelling] = useState(false);

  // Buy detail form state
  const [paymentMethod, setPaymentMethod] = useState((purchaseDetails?.payment_method as string) ?? "");
  const [finalPrice, setFinalPrice] = useState(purchaseDetails?.final_price ? String(purchaseDetails.final_price) : "");
  const [arrangementKind, setArrangementKind] = useState((purchaseDetails?.arrangement_kind as string) ?? "");
  const [schedule, setSchedule] = useState("");
  const [location, setLocation] = useState(autofill?.address ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const canCancel = !["completed", "cancelled", "rejected"].includes(state);
  const isTerminal = ["completed", "cancelled", "rejected"].includes(state);

  async function handleCancel() {
    if (!confirm("Cancel this transaction? This cannot be undone.")) return;
    setCancelling(true);
    const fd = new FormData();
    fd.set("id", id);
    const result = await cancelTransaction(fd);
    setCancelling(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Transaction cancelled.");
      router.refresh();
    }
  }

  async function handleSaveBuyDetails() {
    setSaving(true);
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("payment_method", paymentMethod);
    fd.set("final_price", finalPrice);
    fd.set("arrangement_kind", arrangementKind);
    fd.set("schedule", schedule);
    fd.set("location", location);
    fd.set("notes", notes);
    const result = await saveBuyDetails(fd);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Details saved.");
      router.refresh();
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">
            {vehicles ? `${vehicles.make} ${vehicles.model} (${vehicles.year})` : transactionKindLabel(kind as never)}
          </h1>
          <p className="text-muted-foreground text-sm">
            Opened {format(new Date(openedAt), "MMM d, yyyy")}
            {completedAt ? ` · Completed ${format(new Date(completedAt), "MMM d, yyyy")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={transactionStatusBadgeVariant(state)} className="text-sm">
            {TRANSACTION_STATE_LABELS[state]}
          </Badge>
          <Badge variant="outline" className="text-sm">
            {transactionKindLabel(kind as never)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No status changes yet.</p>
              ) : (
                <div className="flex flex-col gap-0">
                  {history.map((entry, index) => {
                    const toState = entry.to_state as string;
                    const reason = entry.reason as string | null;
                    const changedAt = entry.changed_at as string;
                    return (
                      <div key={entry.id as string} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="size-2.5 rounded-full border-2 border-primary" />
                          {index < history.length - 1 && <div className="w-px flex-1 bg-border" />}
                        </div>
                        <div className="pb-5">
                          <p className="font-medium text-sm capitalize">{toState.replace(/_/g, " ")}</p>
                          {reason && <p className="text-muted-foreground text-xs">{reason}</p>}
                          <p className="text-muted-foreground text-xs">
                            {format(new Date(changedAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buy details form (only for buy transactions, before terminal state) */}
          {kind === "buy" && !isTerminal && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Purchase Details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger id="payment_method">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="financing">Financing</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="down_payment">Down Payment</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="final_price">Final Price (₱)</Label>
                    <Input
                      id="final_price"
                      type="number"
                      min="0"
                      value={finalPrice}
                      onChange={(e) => setFinalPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <Separator />
                <p className="font-medium text-sm">Viewing Arrangement</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="arrangement_kind">Arrangement Type</Label>
                    <Select value={arrangementKind} onValueChange={setArrangementKind}>
                      <SelectTrigger id="arrangement_kind">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="meetup">CALABARZON Meet-up</SelectItem>
                          <SelectItem value="gce_visit">GCE Visit</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="schedule">Schedule</Label>
                    <Input
                      id="schedule"
                      type="datetime-local"
                      value={schedule}
                      onChange={(e) => setSchedule(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Address or meeting point"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions"
                    rows={2}
                  />
                </div>
                <Button onClick={handleSaveBuyDetails} disabled={saving} className="self-start">
                  {saving ? "Saving..." : "Save Details"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Sell details */}
          {kind === "sell" && sellDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sell Details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <DetailRow
                  label="Offered Amount"
                  value={sellDetails.offered_amount ? `₱${Number(sellDetails.offered_amount).toLocaleString()}` : "—"}
                />
                <DetailRow
                  label="Valuation"
                  value={
                    sellDetails.valuation_amount
                      ? `₱${Number(sellDetails.valuation_amount).toLocaleString()}`
                      : "Pending"
                  }
                />
                <DetailRow
                  label="Decision"
                  value={sellDetails.decision ? String(sellDetails.decision).replace("_", " ") : "Pending"}
                />
                <DetailRow label="Review Notes" value={(sellDetails.review_notes as string) ?? "—"} />
              </CardContent>
            </Card>
          )}

          {/* Request-a-Car details */}
          {kind === "request_a_car" && vehicleRequests && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request Details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <DetailRow label="Make" value={vehicleRequests.requested_make as string} />
                <DetailRow label="Model" value={vehicleRequests.requested_model as string} />
                <DetailRow
                  label="Year Range"
                  value={
                    vehicleRequests.year_min || vehicleRequests.year_max
                      ? `${vehicleRequests.year_min ?? "Any"} – ${vehicleRequests.year_max ?? "Any"}`
                      : "Any"
                  }
                />
                <DetailRow
                  label="Budget"
                  value={vehicleRequests.budget ? `₱${Number(vehicleRequests.budget).toLocaleString()}` : "—"}
                />
                <DetailRow label="Other Preferences" value={(vehicleRequests.other_preferences as string) ?? "—"} />
                <DetailRow
                  label="Agreed Price"
                  value={
                    vehicleRequests.agreed_price
                      ? `₱${Number(vehicleRequests.agreed_price).toLocaleString()}`
                      : "Not yet agreed"
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Vehicle card */}
          {vehicles && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Vehicle</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="font-medium">
                  {vehicles.make as string} {vehicles.model as string} ({vehicles.year as number})
                </p>
              </CardContent>
            </Card>
          )}

          {/* Payments */}
          {payments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Payments</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {payments.map((p) => (
                  <div key={p.id as string} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{paymentMethodLabel(p.method as string)}</span>
                    <span className="font-medium">{formatCurrency(Number(p.amount))}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Installments */}
          {installmentAccount && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Installment Plan</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <DetailRow
                  label="Financed"
                  value={`₱${Number((installmentAccount as Record<string, unknown>).financed_total).toLocaleString()}`}
                />
                <DetailRow
                  label="Down Payment"
                  value={`₱${Number((installmentAccount as Record<string, unknown>).down_payment).toLocaleString()}`}
                />
                <DetailRow
                  label="Balance"
                  value={`₱${Number((installmentAccount as Record<string, unknown>).opening_balance).toLocaleString()}`}
                />
                <DetailRow label="Status" value={(installmentAccount as Record<string, unknown>).state as string} />
                {Array.isArray((installmentAccount as Record<string, unknown>).installments) &&
                  ((installmentAccount as Record<string, unknown>).installments as Record<string, unknown>[]).map(
                    (inst) => (
                      <div key={inst.id as string} className="flex justify-between border-t pt-1 text-xs">
                        <span>
                          #{inst.sequence_no as number} · {inst.due_date as string}
                        </span>
                        <span>
                          ₱{Number(inst.amount_due).toLocaleString()} ·{" "}
                          <span className="capitalize">{inst.state as string}</span>
                        </span>
                      </div>
                    ),
                  )}
              </CardContent>
            </Card>
          )}

          {/* Payment Terms */}
          {paymentTerms && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Payment Terms</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <DetailRow
                  label="Description"
                  value={(paymentTerms as Record<string, unknown>).arrangement_description as string}
                />
                <DetailRow
                  label="Total"
                  value={`₱${Number((paymentTerms as Record<string, unknown>).total_amount).toLocaleString()}`}
                />
                <DetailRow
                  label="Payments"
                  value={`${(paymentTerms as Record<string, unknown>).number_of_payments}x ${(paymentTerms as Record<string, unknown>).payment_frequency}`}
                />
                <DetailRow label="Status" value={(paymentTerms as Record<string, unknown>).state as string} />
              </CardContent>
            </Card>
          )}

          {/* Viewing Arrangements */}
          {viewingArrangements.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Viewing Arrangements</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {viewingArrangements.map((va) => (
                  <div key={va.id as string} className="flex flex-col gap-1 text-sm">
                    <span className="font-medium capitalize">
                      {arrangementKindLabel(va.arrangement_kind as string)}
                    </span>
                    {(va.schedule as string) && (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Calendar className="size-3" />
                        {format(new Date(va.schedule as string), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    )}
                    {(va.location as string) && (
                      <span className="text-muted-foreground text-xs">{va.location as string}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground text-xs">No documents uploaded.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {documents.map((doc) => (
                    <div key={doc.id as string} className="flex items-center gap-2 text-sm">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="capitalize">{(doc.document_kind as string).replace(/_/g, " ")}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {doc.verification_state as string}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cancel action */}
          {canCancel && (
            <Button variant="outline" className="w-full" onClick={handleCancel} disabled={cancelling}>
              <XCircle className="mr-2 size-4" />
              {cancelling ? "Cancelling..." : "Cancel Transaction"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
