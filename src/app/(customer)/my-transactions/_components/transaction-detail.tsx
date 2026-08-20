"use client";
"use no memo";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { Calendar, FileText, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { cancelTransaction, saveBuyDetails, uploadPurchaseDocument } from "@/app/(customer)/my-transactions/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn, formatCurrency } from "@/lib/utils";

import type { TransactionPaperProps } from "./transaction-paper";
import { TransactionPreview } from "./transaction-preview";

function ProgressStepper({ state }: { readonly state: TransactionState }) {
  const isCancelled = state === "cancelled" || state === "rejected";
  const labels = isCancelled
    ? ["Requested", "Details", "Documents", "Review", state === "rejected" ? "Rejected" : "Cancelled"]
    : ["Requested", "Details", "Documents", "Review", "Complete"];
  const active = state === "pending" ? 0 : state === "under_review" ? 3 : 4;
  const hints: Record<TransactionState, string> = {
    pending: "We received your request — add your details and documents for review.",
    under_review: "Under review — we are checking your details and documents.",
    approved: "Approved — we are finalising your transaction.",
    completed: "Complete — your transaction is finished.",
    cancelled: "Cancelled — this transaction was stopped. Start a new request if needed.",
    rejected: "Not approved — check the history for the reason or contact support.",
  };
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex flex-wrap items-center gap-2" aria-label="Transaction progress">
          {labels.map((label, index) => {
            const done = index < active;
            const current = index === active;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border font-medium text-xs",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : current
                        ? isCancelled
                          ? "border-destructive bg-destructive text-destructive-foreground"
                          : "border-primary bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span className={cn("text-sm", current ? "font-medium" : "text-muted-foreground")}>{label}</span>
                {index < labels.length - 1 ? (
                  <span className="mx-1 hidden h-px w-8 bg-border sm:block" aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="text-muted-foreground text-sm">{hints[state]}</p>
      </CardContent>
    </Card>
  );
}

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
  const vehicles = transaction.vehicles as Record<string, unknown> | undefined;
  const purchaseDetails = transaction.purchase_details as Record<string, unknown> | undefined;
  const sellDetails = transaction.sell_details as Record<string, unknown> | undefined;
  const vehicleRequests = transaction.vehicle_requests as Record<string, unknown> | undefined;
  const openedAt = transaction.opened_at as string;
  const completedAt = transaction.completed_at as string | null;

  const [localState, setLocalState] = useState<TransactionState | null>(null);
  const state = localState ?? ((transaction.current_state ?? "pending") as TransactionState);
  const [cancelling, setCancelling] = useState(false);

  // Purchase document upload state
  const [docKind, setDocKind] = useState("valid_id");
  const [docIdType, setDocIdType] = useState("");
  const [uploading, setUploading] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);

  const verifiedIdCount = documents.filter(
    (d) => d.document_kind === "valid_id" && d.verification_state === "verified",
  ).length;
  const hasVerifiedBilling = documents.some(
    (d) => d.document_kind === "proof_of_billing" && d.verification_state === "verified",
  );

  async function handleUploadDocument() {
    const file = docFileRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file to upload.");
      return;
    }
    if (docKind === "valid_id" && !docIdType) {
      toast.error("Select the ID type.");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("document_kind", docKind);
    fd.set("id_type", docIdType);
    fd.set("file", file);
    const result = await uploadPurchaseDocument(fd);
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      docKind === "valid_id"
        ? "Valid ID uploaded. GCE staff will verify it."
        : "Proof of billing uploaded. GCE staff will verify it.",
    );
    if (docFileRef.current) docFileRef.current.value = "";
    router.refresh();
  }

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
    setCancelling(true);
    const fd = new FormData();
    fd.set("id", id);
    const result = await cancelTransaction(fd);
    setCancelling(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Transaction cancelled.");
      setLocalState("cancelled");
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

  const make = (vehicles?.make as string) ?? "";
  const model = (vehicles?.model as string) ?? "";
  const year = (vehicles?.year as number) ?? 0;
  const stockCode = (vehicles?.stock_code as string | null) ?? "";
  const vehicleName = `${make} ${model} (${year})`.trim();

  const paperItems: TransactionPaperProps["items"] = (() => {
    if (kind === "buy") {
      const unitPrice = Number(purchaseDetails?.final_price ?? vehicles?.current_price ?? 0);
      return [
        {
          id: "vehicle",
          description: `${vehicleName}${stockCode ? ` · ${stockCode}` : ""}`,
          quantity: 1,
          unitPrice,
        },
      ];
    }
    if (kind === "sell") {
      return [
        {
          id: "vehicle",
          description: `Vehicle sale — ${vehicleName || transactionKindLabel(kind as never)}`,
          quantity: 1,
          unitPrice: Number(sellDetails?.offered_amount ?? 0),
        },
      ];
    }
    return [
      {
        id: "request",
        description: `Requested vehicle — ${(vehicleRequests?.requested_make as string) ?? ""} ${(vehicleRequests?.requested_model as string) ?? ""}`,
        quantity: 1,
        unitPrice: Number(vehicleRequests?.budget ?? 0),
      },
    ];
  })();

  const paper: TransactionPaperProps = {
    reference: id.slice(0, 8).toUpperCase(),
    issuedDate: format(new Date(openedAt), "yyyy-MM-dd"),
    stateLabel: TRANSACTION_STATE_LABELS[state],
    items: paperItems,
    total: paperItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    from: {
      name: "GCE Auto",
      email: "sales@gceauto.ph",
      website: "gceauto.ph",
      addressLines: ["CALABARZON", "Philippines"],
      issuerName: "GCE Auto Sales",
    },
    billTo: {
      name: autofill?.full_name ?? "Customer",
      email: autofill?.email ?? "",
      addressLines: autofill?.address ? [autofill.address] : [],
    },
  };

  return (
    <>
      <ProgressStepper state={state} />
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">{vehicleName || transactionKindLabel(kind as never)}</h1>
          <p className="text-muted-foreground text-sm">
            Opened {format(new Date(openedAt), "MMM d, yyyy")}
            {completedAt ? ` · Completed ${format(new Date(completedAt), "MMM d, yyyy")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={transactionStatusBadgeVariant(state)} className="text-sm">
            {TRANSACTION_STATE_LABELS[state]}
          </Badge>
          <Badge variant="outline" className="text-sm">
            {transactionKindLabel(kind as never)}
          </Badge>
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <XCircle className="mr-2 size-4" />
                  Cancel Transaction
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <XCircle className="text-destructive" />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Cancel this transaction?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel the transaction and cannot be undone. Are you sure you want to continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Transaction</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={cancelling}>
                    {cancelling ? "Cancelling..." : "Yes, Cancel Transaction"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Form column */}
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          {kind === "buy" && !isTerminal && (
            <>
              <section className="flex flex-col gap-4">
                <h2 className="font-medium tracking-tight">Purchase Details</h2>
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
              </section>
              <Separator />
            </>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="font-medium tracking-tight">Status History</h2>
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
          </section>
          <Separator />

          {kind === "sell" && sellDetails && (
            <>
              <section className="flex flex-col gap-3">
                <h2 className="font-medium tracking-tight">Sell Details</h2>
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
              </section>
              <Separator />
            </>
          )}

          {kind === "request_a_car" && vehicleRequests && (
            <>
              <section className="flex flex-col gap-3">
                <h2 className="font-medium tracking-tight">Request Details</h2>
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
              </section>
              <Separator />
            </>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="font-medium tracking-tight">Documents</h2>
            {kind === "buy" && !isTerminal ? (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-xs">
                    GCE requires two valid IDs and one proof of billing to complete your purchase.
                  </p>
                </div>
                <p className="text-xs">
                  <span className="font-medium">{Math.min(verifiedIdCount, 2)}/2</span> valid IDs verified
                  {hasVerifiedBilling ? " · proof of billing verified" : " · proof of billing pending"}
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="cust-doc-kind" className="text-xs">
                      Document
                    </Label>
                    <Select value={docKind} onValueChange={setDocKind}>
                      <SelectTrigger id="cust-doc-kind" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="valid_id">Valid ID</SelectItem>
                          <SelectItem value="proof_of_billing">Proof of Billing</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  {docKind === "valid_id" ? (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="cust-doc-id-type" className="text-xs">
                        ID Type
                      </Label>
                      <Select value={docIdType} onValueChange={setDocIdType}>
                        <SelectTrigger id="cust-doc-id-type" className="w-36">
                          <SelectValue placeholder="Select ID" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="drivers_license">Driver's License</SelectItem>
                            <SelectItem value="umid">UMID</SelectItem>
                            <SelectItem value="sss_id">SSS ID</SelectItem>
                            <SelectItem value="gsis_id">GSIS ID</SelectItem>
                            <SelectItem value="philhealth_id">PhilHealth ID</SelectItem>
                            <SelectItem value="voters_id">Voter's ID</SelectItem>
                            <SelectItem value="national_id">National ID</SelectItem>
                            <SelectItem value="prc_id">PRC ID</SelectItem>
                            <SelectItem value="postal_id">Postal ID</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <Input
                    ref={docFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="w-44"
                  />
                  <Button size="sm" onClick={handleUploadDocument} disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </>
            ) : null}
            {documents.length === 0 ? (
              <p className="text-muted-foreground text-xs">No documents uploaded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {documents.map((doc) => (
                  <div key={doc.id as string} className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="capitalize">{(doc.document_kind as string).replace(/_/g, " ")}</span>
                    {doc.id_type ? (
                      <span className="text-muted-foreground text-xs capitalize">
                        {(doc.id_type as string).replace(/_/g, " ")}
                      </span>
                    ) : null}
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {doc.verification_state as string}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
          <Separator />

          <section className="flex flex-col gap-3">
            <h2 className="font-medium tracking-tight">Financial Summary</h2>
            {payments.length > 0 && (
              <div className="flex flex-col gap-2">
                {payments.map((p) => (
                  <div key={p.id as string} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{paymentMethodLabel(p.method as string)}</span>
                    <span className="font-medium">{formatCurrency(Number(p.amount))}</span>
                  </div>
                ))}
              </div>
            )}

            {installmentAccount && (
              <div className="flex flex-col gap-2 text-sm">
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
              </div>
            )}

            {paymentTerms && (
              <div className="flex flex-col gap-2 text-sm">
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
              </div>
            )}

            {viewingArrangements.length > 0 && (
              <div className="flex flex-col gap-2">
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
              </div>
            )}
          </section>
        </div>

        {/* Preview column */}
        <TransactionPreview paper={paper} />
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
