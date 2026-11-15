"use client";
"use no memo";

import { useRef, useState, useTransition } from "react";

import { format } from "date-fns";
import { toast } from "sonner";

import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nextDuePayment } from "@/lib/transactions/buy-flow";
import { paidInstallmentCount } from "@/lib/transactions/financing-payments";
import {
  arrangementKindLabel,
  paymentKindLabel,
  paymentMethodLabel,
  TRANSACTION_STATE_LABELS,
} from "@/lib/transactions/labels";
import type { TransactionState } from "@/lib/transactions/state-machine";
import { compressImage } from "@/lib/uploads/compress-image";
import { formatCurrency } from "@/lib/utils";

export function normalizeConditionItems(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      return normalizeConditionItems(JSON.parse(value));
    } catch {
      return [value];
    }
  }
  return [];
}

// T11: what the payments on record say about one installment, so the schedule tells the Sales Manager whether
// the row is only recorded or already counted.
function installmentPaymentState(
  installmentId: unknown,
  payments: Record<string, unknown>[],
): "confirmed" | "rejected" | "recorded" | null {
  const rows = payments.filter((payment) => payment.installment_id === installmentId);
  if (rows.some((payment) => payment.verified_by)) return "confirmed";
  if (rows.some((payment) => payment.rejected_at)) return "rejected";
  return rows.length > 0 ? "recorded" : null;
}

const INSTALLMENT_PAYMENT_LABELS = {
  confirmed: "Confirmed",
  rejected: "Rejected",
  recorded: "Recorded, waiting for confirmation",
} as const;

// An advance payment settles installments whose due date is still ahead: the 1st of this month or later.
function advanceInstallmentIds(installments: Record<string, unknown>[]): string[] {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return installments
    .filter((installment) => !["paid", "waived"].includes(String(installment.state)))
    .filter((installment) => typeof installment.due_date === "string" && installment.due_date >= firstOfMonth)
    .map((installment) => String(installment.id));
}

export function TransactionDetailSidebarV1({
  kind,
  state,
  userRole,
  paymentMethod,
  purchaseDetails,
  paymentTerms,
  flowStatus,
  payments,
  documents,
  history,
  installmentAccount,
  viewingArrangements,
  informants,
  headSecurity = [],
  sellDetails,
  sellPhotos,
  conditionItems,
  checklistNameMap,
  onRecordPayment,
  onRecordPaperwork,
  onWaiveInstallment,
  onRecordInstallmentPaid,
  onRecordAdvancePayment,
  onInstructRepossession,
}: {
  readonly kind: string;
  readonly state: string;
  readonly userRole: string;
  // The purchase method. A Bank Transfer buy is paid online through PayMongo, so staff do not record it by hand.
  readonly paymentMethod?: string;
  // T05: Record Payment reads the price and the terms to work out the one payment now due.
  readonly purchaseDetails?: Record<string, unknown> | null;
  readonly paymentTerms?: Record<string, unknown> | null;
  readonly flowStatus?: string | null;
  readonly payments: Record<string, unknown>[];
  readonly documents: Record<string, unknown>[];
  readonly history: Record<string, unknown>[];
  readonly installmentAccount: Record<string, unknown> | null;
  readonly viewingArrangements: Record<string, unknown>[];
  readonly informants: { id: string; full_name: string | null }[];
  readonly headSecurity?: { id: string; full_name: string | null }[];
  readonly sellDetails: Record<string, unknown> | undefined;
  // Optional Task 32 props: page.tsx (orchestrator-owned) may pass these later.
  // Falls back to deriving sell photos from `documents` (document_kind === "sell_photo").
  readonly sellPhotos?: { id: string; is_image: boolean; signed_url: string | null }[];
  // Raw condition_items from sell_details (array of checklist node ids or names).
  readonly conditionItems?: unknown;
  // Optional id → display-name map for inspection_checklist_nodes.
  readonly checklistNameMap?: Record<string, string>;
  // Resolves true once the payment is on record, so the form can show the wait-for-check note.
  readonly onRecordPayment: (
    amount: string,
    method: string,
    date: string,
    paymentKind: string,
    proof?: File,
  ) => Promise<boolean>;
  readonly onRecordPaperwork: (documentKind: string) => Promise<void>;
  readonly onWaiveInstallment: (installmentId: string) => Promise<void>;
  readonly onRecordInstallmentPaid?: (installmentId: string, amount: string) => Promise<void>;
  /** T11: records one cash payment covering the installments the Sales Manager ticked. */
  readonly onRecordAdvancePayment?: (installmentIds: string[]) => Promise<void>;
  readonly onInstructRepossession: (informantId: string, reason: string, headSecurityId: string) => Promise<void>;
}) {
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  // A Bank Transfer buy is normally confirmed by PayMongo; the cash fallback (the buyer pays on the day)
  // still needs the amount and the kind, because no payment is due from the server's point of view.
  const [manualAmount, setManualAmount] = useState("");
  const [manualKind, setManualKind] = useState("full");
  const proofFileRef = useRef<HTMLInputElement>(null);
  // T05: the button is disabled while the submit runs, and the form is replaced by the wait-for-check
  // note. The ref also stops a fast double click that lands before React renders the disabled state.
  const [submittingPayment, startPayment] = useTransition();
  const submittingRef = useRef(false);
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoInformant, setRepoInformant] = useState("");
  const [repoHeadSecurity, setRepoHeadSecurity] = useState("");
  const [repoReason, setRepoReason] = useState("");
  // T11: the inline multi-select for an advance payment over the upcoming installments.
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advancePicked, setAdvancePicked] = useState<string[]>([]);

  const insts = installmentAccount
    ? (((installmentAccount as Record<string, unknown>).installments as Record<string, unknown>[]) ?? [])
    : [];
  const hasDueOrOverdue = insts.some(
    (inst: Record<string, unknown>) => inst.state === "due" || inst.state === "overdue",
  );
  const tState = state as TransactionState;
  // Task 32 role scoping: CEO approves (triage Approve/Reject + sell review), doesn't process.
  // Processing actions (upload / record payment / record paperwork) are hidden for CEO;
  // docs and payments stay visible read-only. Head Accountant verifies documents.
  const isCeo = userRole === "ceo";
  // Only the Head Accountant may verify purchase documents, so the buttons match
  // the server-side guard in verifyTransactionDocument.
  const canRecordCash = userRole === "sales_manager" || userRole === "ceo";
  const docSellPhotos = documents.filter((doc) => String(doc.document_kind) === "sell_photo");
  const photos =
    sellPhotos && sellPhotos.length > 0
      ? sellPhotos
      : docSellPhotos.map((doc) => ({
          id: String(doc.id),
          is_image: doc.is_image === true,
          signed_url: typeof doc.signed_url === "string" ? doc.signed_url : null,
        }));
  const rawConditionItems =
    conditionItems ?? (sellDetails ? (sellDetails as Record<string, unknown>).condition_items : undefined);
  const conditionList = normalizeConditionItems(rawConditionItems).map((item) => checklistNameMap?.[item] ?? item);

  const showSellExtras = kind === "sell" && (photos.length > 0 || conditionList.length > 0);

  // T05: Record Payment fills itself in. Only a CASH buy has one payment due at a time; a Bank Transfer
  // is confirmed by PayMongo, and a financing buy pays through its installments.
  const cashBuy = kind === "buy" && purchaseDetails?.payment_method === "cash";
  const bankTransferBuy = kind === "buy" && paymentMethod === "bank_transfer";
  // T11: the Initial Downpayment of a financing buy is cash at GCE, so the Sales Manager needs the box too.
  const financingBuy = kind === "buy" && purchaseDetails?.payment_method === "financing";
  const financingDownpayment = financingBuy
    ? Number(purchaseDetails?.downpayment_amount ?? paymentTerms?.down_payment ?? 0)
    : 0;
  const financingDownpaymentPaid =
    financingDownpayment > 0 &&
    payments.some((payment) => payment.payment_kind === "downpayment" && payment.verified_by && !payment.rejected_at);
  // The agreed price: purchase_details carries it, with the approved terms as the fallback.
  const agreedPrice = Number(purchaseDetails?.final_price ?? paymentTerms?.total_amount ?? 0);
  const duePayment =
    kind === "buy"
      ? nextDuePayment(
          purchaseDetails ? { ...purchaseDetails, final_price: purchaseDetails.final_price ?? agreedPrice } : null,
          payments,
          flowStatus ?? null,
        )
      : null;
  // A payment on record but not yet checked keeps the form away, so the record cannot be spammed.
  const awaitingCheck = payments.some((payment) => !payment.rejected_at && !payment.verified_by);
  // T11: a financing buy records only the Initial Downpayment here, and only while it is not verified yet.
  const recordFinancingDownpayment =
    financingBuy && financingDownpayment > 0 && flowStatus === "purchase_claim" && !financingDownpaymentPaid;
  const canRecordPayment =
    userRole === "sales_manager" &&
    ["approved", "completed"].includes(tState) &&
    (recordFinancingDownpayment ||
      bankTransferBuy ||
      (cashBuy && (paymentRecorded || awaitingCheck || duePayment !== null)));
  // Once the downpayment is on record the form gives way to the wait-for-check note, like the cash path.
  const showFinancingDownpaymentForm = recordFinancingDownpayment && !paymentRecorded && !awaitingCheck;

  function submitPayment() {
    // A CASH buy always uses the payment the server worked out. A Bank Transfer buy has no server-side
    // payment due, so the cash fallback sends what the Sales Manager typed.
    const target = showFinancingDownpaymentForm
      ? { kind: "downpayment", amount: financingDownpayment, method: "cash" }
      : (duePayment ??
        (bankTransferBuy && manualAmount.trim() !== ""
          ? { kind: manualKind, amount: Number(manualAmount), method: "cash" }
          : null));
    if (!target || submittingRef.current) return;
    submittingRef.current = true;
    const picked = proofFileRef.current?.files?.[0];
    startPayment(async () => {
      try {
        const proof = picked ? await compressImage(picked) : undefined;
        const recorded = await onRecordPayment(String(target.amount), target.method, payDate, target.kind, proof);
        if (recorded) {
          setPaymentRecorded(true);
          if (proofFileRef.current) proofFileRef.current.value = "";
        }
      } finally {
        submittingRef.current = false;
      }
    });
  }

  async function handleAdvance() {
    if (advancePicked.length === 0) {
      toast.error("Tick at least one installment.");
      return;
    }
    await onRecordAdvancePayment?.(advancePicked);
    setAdvanceOpen(false);
    setAdvancePicked([]);
  }

  async function handleInstruct() {
    if (!repoInformant) {
      toast.error("Select a Confidential Informant.");
      return;
    }
    await onInstructRepossession(repoInformant, repoReason, repoHeadSecurity);
    setRepoOpen(false);
    setRepoInformant("");
    setRepoReason("");
  }

  return (
    <Card className="h-full shadow-xs">
      <CardHeader>
        <CardTitle>Transaction Details</CardTitle>
        <CardDescription>Stats, history, documents, and actions</CardDescription>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex h-full flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Payments" value={String(payments.length)} />
            <StatCard label="Documents" value={String(documents.length)} />
            <StatCard label="Status changes" value={String(history.length)} />
            <StatCard label="Installments" value={String(insts.length)} mono />
          </div>

          <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
            <p className="text-muted-foreground text-xs">Status history</p>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-xs">No status changes.</p>
            ) : (
              history
                .slice(-5)
                .reverse()
                .map((entry) => (
                  <div key={entry.id as string} className="space-y-1 rounded-md border bg-background/70 px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm capitalize">
                        {(entry.to_state as string).replace(/_/g, " ")}
                      </span>
                      <Badge className="h-5 px-2 text-[11px]">
                        {format(new Date(entry.changed_at as string), "MMM d")}
                      </Badge>
                    </div>
                    {entry.reason ? <p className="text-muted-foreground text-xs">{entry.reason as string}</p> : null}
                  </div>
                ))
            )}
          </div>

          {installmentAccount && insts.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">Installment schedule</p>
                <Badge className="h-5 px-2 text-[11px] tabular-nums">
                  Paid {paidInstallmentCount(insts.map((inst) => ({ state: inst.state })))} of {insts.length}
                </Badge>
              </div>
              {userRole === "head_accountant" && hasDueOrOverdue && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5">
                  <p className="text-destructive text-xs">Due or overdue installments.</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setRepoOpen(true)}
                  >
                    Instruct Repossession
                  </Button>
                </div>
              )}
              {canRecordCash && onRecordAdvancePayment && advanceInstallmentIds(insts).length > 0 ? (
                <div className="space-y-1.5 rounded-md border bg-background/70 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs">Advance payment</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setAdvanceOpen((open) => !open);
                        setAdvancePicked([]);
                      }}
                    >
                      {advanceOpen ? "Cancel" : "Record advance payment"}
                    </Button>
                  </div>
                  {advanceOpen ? (
                    <>
                      {advanceInstallmentIds(insts).map((installmentId) => (
                        <label
                          key={installmentId}
                          className="flex items-center gap-2 text-xs"
                          htmlFor={`advance-${installmentId}`}
                        >
                          <Checkbox
                            id={`advance-${installmentId}`}
                            checked={advancePicked.includes(installmentId)}
                            onCheckedChange={(checked) =>
                              setAdvancePicked((picked) =>
                                checked === true
                                  ? [...picked, installmentId]
                                  : picked.filter((pickedId) => pickedId !== installmentId),
                              )
                            }
                          />
                          <span className="tabular-nums">
                            #{String(insts.find((inst) => inst.id === installmentId)?.sequence_no ?? "")} ·{" "}
                            {String(insts.find((inst) => inst.id === installmentId)?.due_date ?? "")} ·{" "}
                            {formatCurrency(Number(insts.find((inst) => inst.id === installmentId)?.amount_due ?? 0))}
                          </span>
                        </label>
                      ))}
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={advancePicked.length === 0 || submittingPayment}
                        onClick={handleAdvance}
                      >
                        Pay {advancePicked.length} in advance
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
              {insts.map((inst: Record<string, unknown>) => (
                <div key={inst.id as string} className="space-y-1 rounded-md border bg-background/70 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm tabular-nums">#{inst.sequence_no as number}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">{inst.due_date as string}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm tabular-nums">
                      {formatCurrency(Number(inst.amount_due))}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={inst.state === "overdue" || inst.state === "due" ? "destructive" : "secondary"}
                        className="h-5 px-2 text-[11px]"
                      >
                        {inst.state as string}
                      </Badge>
                      <InstallmentPaymentBadge installmentId={inst.id} payments={payments} />
                      {inst.state !== "paid" &&
                      inst.state !== "waived" &&
                      canRecordCash &&
                      onRecordInstallmentPaid &&
                      // A payment already waiting for review is not recorded a second time.
                      !payments.some((payment) => payment.installment_id === inst.id && !payment.rejected_at) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => onRecordInstallmentPaid(inst.id as string, String(inst.amount_due))}
                        >
                          Record payment
                        </Button>
                      ) : null}
                      {inst.state !== "paid" && inst.state !== "waived" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => onWaiveInstallment(inst.id as string)}
                        >
                          Waive
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showSellExtras ? (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">Vehicle photos & condition</p>
                <Badge className="h-5 px-2 text-[11px] tabular-nums">
                  {photos.length} photo{photos.length === 1 ? "" : "s"}
                </Badge>
              </div>
              {photos.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {photos.map((photo) => (
                    <li key={photo.id} className="rounded-md border bg-background/70 p-2.5">
                      {photo.signed_url && photo.is_image ? (
                        <TransactionImagePreview src={photo.signed_url} alt="Sell vehicle attachment" />
                      ) : (
                        <p className="text-muted-foreground text-xs">Preview unavailable</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {conditionList.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {conditionList.map((item) => (
                    <li key={item} className="rounded-md border bg-background/70 px-2.5 py-1.5 text-xs">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-xs">No condition checklist submitted.</p>
              )}
            </div>
          ) : null}

          {viewingArrangements.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Viewing arrangements</p>
              {viewingArrangements.map((va) => (
                <div
                  key={va.id as string}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background/70 px-2.5 py-1.5"
                >
                  <span className="font-medium text-sm capitalize">
                    {arrangementKindLabel(va.arrangement_kind as string)}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {va.schedule ? format(new Date(va.schedule as string), "MMM d, h:mm a") : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {canRecordPayment && (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">
                {showFinancingDownpaymentForm ? "Initial Downpayment" : "Record payment"}
              </p>
              {showFinancingDownpaymentForm ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dp_amount" className="text-xs">
                      Amount (₱)
                    </Label>
                    <Input
                      id="dp_amount"
                      readOnly
                      className="h-7 text-xs tabular-nums"
                      value={formatCurrency(financingDownpayment)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="dp_kind" className="text-xs">
                        Payment for
                      </Label>
                      <Input id="dp_kind" readOnly className="h-7 text-xs" value={paymentKindLabel("downpayment")} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="dp_method" className="text-xs">
                        Method
                      </Label>
                      <Input id="dp_method" readOnly className="h-7 text-xs" value={paymentMethodLabel("cash")} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dp_date" className="text-xs">
                      Date
                    </Label>
                    <Input
                      id="dp_date"
                      type="date"
                      className="h-7 text-xs"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dp_proof" className="text-xs">
                      Photo of deposit slip / receipt (optional)
                    </Label>
                    <Input
                      id="dp_proof"
                      ref={proofFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="h-7 w-full text-xs"
                    />
                  </div>
                  <Button size="sm" className="h-7 w-full text-xs" disabled={submittingPayment} onClick={submitPayment}>
                    {submittingPayment ? "Recording…" : "Record Initial Downpayment"}
                  </Button>
                </>
              ) : bankTransferBuy ? (
                <>
                  <p className="text-muted-foreground text-xs">
                    Bank Transfer is paid online through PayMongo and confirmed automatically.
                  </p>
                  {paymentRecorded || awaitingCheck ? (
                    <p className="text-xs">Recorded, waiting for the Head Accountant&apos;s check.</p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="manual_amount" className="text-xs">
                          Amount (₱)
                        </Label>
                        <Input
                          id="manual_amount"
                          type="number"
                          className="h-7 text-xs"
                          value={manualAmount}
                          onChange={(e) => setManualAmount(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="manual_kind" className="text-xs">
                          Payment for
                        </Label>
                        <Select value={manualKind} onValueChange={setManualKind}>
                          <SelectTrigger id="manual_kind" className="h-7 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full payment</SelectItem>
                            <SelectItem value="delivery_fee">Delivery fee</SelectItem>
                            <SelectItem value="downpayment">Downpayment</SelectItem>
                            <SelectItem value="balance">Balance on delivery</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="manual_proof" className="text-xs">
                          Photo of deposit slip / receipt (optional)
                        </Label>
                        <Input
                          id="manual_proof"
                          ref={proofFileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="h-7 w-full text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="h-7 w-full text-xs"
                        disabled={submittingPayment || manualAmount.trim() === ""}
                        onClick={submitPayment}
                      >
                        {submittingPayment ? "Recording..." : "Record Payment"}
                      </Button>
                    </>
                  )}
                </>
              ) : paymentRecorded || awaitingCheck ? (
                <p className="text-xs">Recorded, waiting for the Head Accountant&apos;s check.</p>
              ) : duePayment ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pay_amount" className="text-xs">
                      Amount (₱)
                    </Label>
                    <Input
                      id="pay_amount"
                      readOnly
                      className="h-7 text-xs tabular-nums"
                      value={formatCurrency(duePayment.amount)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pay_kind" className="text-xs">
                        Payment for
                      </Label>
                      <Input id="pay_kind" readOnly className="h-7 text-xs" value={paymentKindLabel(duePayment.kind)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pay_method" className="text-xs">
                        Method
                      </Label>
                      <Input
                        id="pay_method"
                        readOnly
                        className="h-7 text-xs"
                        value={paymentMethodLabel(duePayment.method)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pay_date" className="text-xs">
                      Date
                    </Label>
                    <Input
                      id="pay_date"
                      type="date"
                      className="h-7 text-xs"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pay_proof" className="text-xs">
                      Photo of deposit slip / receipt (optional)
                    </Label>
                    <Input
                      id="pay_proof"
                      ref={proofFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="h-7 w-full text-xs"
                    />
                  </div>
                  <Button size="sm" className="h-7 w-full text-xs" disabled={submittingPayment} onClick={submitPayment}>
                    {submittingPayment ? "Recording…" : "Record Payment"}
                  </Button>
                </>
              ) : null}
            </div>
          )}

          {tState === "completed" && !isCeo && (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Record paperwork</p>
              <div className="flex gap-1.5">
                {["invoice", "receipt"].map((dk) => (
                  <Button
                    key={dk}
                    variant="outline"
                    size="sm"
                    className="h-6 flex-1 px-2 text-xs"
                    onClick={() => onRecordPaperwork(dk)}
                  >
                    Record {dk}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
            <span className="text-muted-foreground text-xs">Transaction state</span>
            <span className="font-medium text-xs capitalize tabular-nums">{TRANSACTION_STATE_LABELS[tState]}</span>
          </div>
        </div>
      </CardContent>

      <Dialog open={repoOpen} onOpenChange={setRepoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instruct Repossession</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repo-informant">Confidential Informant</Label>
              <Select value={repoInformant} onValueChange={setRepoInformant}>
                <SelectTrigger id="repo-informant">
                  <SelectValue placeholder="Select informant" />
                </SelectTrigger>
                <SelectContent>
                  {informants.map((informant) => (
                    <SelectItem key={informant.id} value={informant.id}>
                      {informant.full_name ?? informant.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repo-head-security">Head Security</Label>
              <Select value={repoHeadSecurity} onValueChange={setRepoHeadSecurity}>
                <SelectTrigger id="repo-head-security">
                  <SelectValue placeholder="Select Head Security" />
                </SelectTrigger>
                <SelectContent>
                  {headSecurity.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.full_name ?? person.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repo-reason">Reason (optional)</Label>
              <Input
                id="repo-reason"
                value={repoReason}
                onChange={(e) => setRepoReason(e.target.value)}
                placeholder="e.g. Buyer missed two consecutive payments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRepoOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={informants.length === 0} onClick={handleInstruct}>
              {informants.length === 0 ? "No informants available" : "Instruct"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InstallmentPaymentBadge({
  installmentId,
  payments,
}: {
  readonly installmentId: unknown;
  readonly payments: Record<string, unknown>[];
}) {
  const state = installmentPaymentState(installmentId, payments);
  if (!state) return null;
  return (
    <Badge variant={state === "rejected" ? "destructive" : "outline"} className="h-5 px-2 text-[11px]">
      {INSTALLMENT_PAYMENT_LABELS[state]}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={mono ? "font-semibold text-base tabular-nums" : "font-semibold text-base"}>{value}</p>
    </div>
  );
}
