"use client";
"use no memo";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { Calendar, CheckCircle, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  activatePaymentTerms,
  approvePaymentTerms,
  instructRepossession,
  markInstallmentWaived,
  recordPaperwork,
  recordPayment,
  reviewSellTransaction,
  transitionTransaction,
  verifyPayment,
  verifyTransactionDocument,
} from "@/app/(staff)/transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  arrangementKindLabel,
  paymentMethodLabel,
  TRANSACTION_STATE_LABELS,
  transactionKindLabel,
  transactionStatusBadgeVariant,
} from "@/lib/transactions/labels";
import { getAllowedTransitions, type TransactionState } from "@/lib/transactions/state-machine";
import { formatCurrency } from "@/lib/utils";

export function StaffTransactionDetail({
  transaction,
  history,
  documents,
  payments,
  installmentAccount,
  paymentTerms,
  viewingArrangements,
  userRole,
  informants,
}: {
  readonly transaction: Record<string, unknown>;
  readonly history: Record<string, unknown>[];
  readonly documents: Record<string, unknown>[];
  readonly payments: Record<string, unknown>[];
  readonly installmentAccount: Record<string, unknown> | null;
  readonly paymentTerms: Record<string, unknown> | null;
  readonly viewingArrangements: Record<string, unknown>[];
  readonly userRole: string;
  readonly informants: { id: string; full_name: string | null }[];
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

  const allowed = getAllowedTransitions(state, userRole);
  const [transitioning, setTransitioning] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "overview" | "history" | "payments" | "installments" | "documents"
  >("overview");

  // Payment record form
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef, _setPayRef] = useState("");

  // Sell review form
  const [valuation, setValuation] = useState(sellDetails?.valuation_amount ? String(sellDetails.valuation_amount) : "");
  const [reviewNotes, setReviewNotes] = useState((sellDetails?.review_notes as string) ?? "");

  // Repossession form
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoInformant, setRepoInformant] = useState("");
  const [repoReason, setRepoReason] = useState("");

  // Purchase document upload
  const [docKind, setDocKind] = useState("valid_id");
  const [docIdType, setDocIdType] = useState("");
  const docFileRef = useRef<HTMLInputElement>(null);

  async function handleUploadPurchaseDocument() {
    const file = docFileRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file to upload.");
      return;
    }
    if (docKind === "valid_id" && !docIdType) {
      toast.error("Select the ID type.");
      return;
    }
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("document_kind", docKind);
    fd.set("id_type", docIdType);
    fd.set("file", file);
    const result = await recordPaperwork(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success(
        docKind === "valid_id" ? "Valid ID uploaded. Verify it below." : "Proof of billing uploaded. Verify it below.",
      );
      if (docFileRef.current) docFileRef.current.value = "";
      router.refresh();
    }
  }

  async function handleInstructRepossession() {
    if (!repoInformant) {
      toast.error("Select a Confidential Informant.");
      return;
    }
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("informant_id", repoInformant);
    if (repoReason) fd.set("reason", repoReason);
    const result = await instructRepossession(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Repossession instructed. A recovery field case was created.");
      setRepoOpen(false);
      setRepoInformant("");
      setRepoReason("");
      router.refresh();
    }
  }

  async function doTransition(to: TransactionState) {
    setTransitioning(true);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("to_state", to);
    const result = await transitionTransaction(fd);
    setTransitioning(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Transaction moved to ${to.replace(/_/g, " ")}.`);
      router.refresh();
    }
  }

  async function handleRecordPayment() {
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("amount", payAmount);
    fd.set("method", payMethod);
    fd.set("settlement_date", payDate);
    if (payRef) fd.set("external_reference", payRef);
    const result = await recordPayment(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Payment recorded.");
      router.refresh();
    }
  }

  async function handleReviewSell(decision: string) {
    const fd = new FormData();
    fd.set("transaction_id", id);
    fd.set("valuation_amount", valuation);
    fd.set("decision", decision);
    fd.set("review_notes", reviewNotes);
    const result = await reviewSellTransaction(fd);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Sell ${decision}.`);
      router.refresh();
    }
  }

  const insts = installmentAccount
    ? (((installmentAccount as Record<string, unknown>).installments as Record<string, unknown>[]) ?? [])
    : [];

  const hasDueOrOverdue = insts.some(
    (inst: Record<string, unknown>) => inst.state === "due" || inst.state === "overdue",
  );

  return (
    <>
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

      <ToggleGroup
        type="single"
        size="sm"
        spacing={0}
        variant="outline"
        value={activeSection}
        onValueChange={(value) => {
          if (value) setActiveSection(value as typeof activeSection);
        }}
      >
        <ToggleGroupItem value="overview">Overview</ToggleGroupItem>
        <ToggleGroupItem value="history">Status History</ToggleGroupItem>
        <ToggleGroupItem value="payments">Payments</ToggleGroupItem>
        <ToggleGroupItem value="installments">Installments</ToggleGroupItem>
        <ToggleGroupItem value="documents">Documents</ToggleGroupItem>
      </ToggleGroup>

      {activeSection === "overview" ? (
        <div className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              {/* Buy details */}
              {kind === "buy" && purchaseDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Purchase Details</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <Row label="Payment Method" value={paymentMethodLabel(purchaseDetails.payment_method as string)} />
                    <Row
                      label="Final Price"
                      value={
                        purchaseDetails.final_price ? `₱${Number(purchaseDetails.final_price).toLocaleString()}` : "—"
                      }
                    />
                    <Row
                      label="Arrangement"
                      value={
                        purchaseDetails.arrangement_kind
                          ? arrangementKindLabel(purchaseDetails.arrangement_kind as string)
                          : "—"
                      }
                    />
                    <Row label="Document Check" value={purchaseDetails.document_check_state as string} />
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
                    <Row
                      label="Offered Amount"
                      value={
                        sellDetails.offered_amount ? `₱${Number(sellDetails.offered_amount).toLocaleString()}` : "—"
                      }
                    />
                    <Row label="Decision" value={sellDetails.decision ? String(sellDetails.decision) : "Pending"} />
                    {!sellDetails.decision && userRole === "sales_manager" && (
                      <div className="flex flex-col gap-3 border-t pt-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="valuation">Valuation (₱)</Label>
                          <Input
                            id="valuation"
                            type="number"
                            value={valuation}
                            onChange={(e) => setValuation(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="review_notes">Notes</Label>
                          <Input
                            id="review_notes"
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleReviewSell("accepted")}>
                            <CheckCircle className="mr-1.5 size-3.5" /> Accept
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReviewSell("rejected")}>
                            <XCircle className="mr-1.5 size-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
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
                    <Row label="Make" value={vehicleRequests.requested_make as string} />
                    <Row label="Model" value={vehicleRequests.requested_model as string} />
                    <Row
                      label="Budget"
                      value={vehicleRequests.budget ? `₱${Number(vehicleRequests.budget).toLocaleString()}` : "—"}
                    />
                    <Row
                      label="Assigned Informant"
                      value={vehicleRequests.assigned_confidential_informant ? "Assigned" : "Not assigned"}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Viewing Arrangements */}
              {viewingArrangements.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Viewing Arrangements</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {viewingArrangements.map((va) => (
                      <div key={va.id as string} className="flex items-center gap-3 text-sm">
                        <Calendar className="size-4 text-muted-foreground" />
                        <span className="capitalize">{arrangementKindLabel(va.arrangement_kind as string)}</span>
                        {(va.schedule as string) && (
                          <span className="text-muted-foreground">
                            {format(new Date(va.schedule as string), "MMM d, yyyy h:mm a")}
                          </span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar actions */}
            <div className="flex flex-col gap-4">
              {allowed.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {allowed.map((to) => (
                      <Button
                        key={to}
                        variant={to === "cancelled" || to === "rejected" ? "destructive" : "default"}
                        size="sm"
                        onClick={() => doTransition(to)}
                        disabled={transitioning}
                      >
                        {to.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Record Payment */}
              {["approved", "completed"].includes(state) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Record Payment</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pay_amount">Amount (₱)</Label>
                      <Input
                        id="pay_amount"
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pay_method">Method</Label>
                      <Select value={payMethod} onValueChange={setPayMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pay_date">Date</Label>
                      <Input id="pay_date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                    </div>
                    <Button size="sm" onClick={handleRecordPayment}>
                      Record Payment
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Payment Terms */}
              {kind === "buy" && paymentTerms && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Payment Terms</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <Row
                      label="Total"
                      value={`₱${Number((paymentTerms as Record<string, unknown>).total_amount).toLocaleString()}`}
                    />
                    <Row label="State" value={(paymentTerms as Record<string, unknown>).state as string} />
                    {(paymentTerms as Record<string, unknown>).state === "proposed" && (
                      <Button
                        size="sm"
                        onClick={() => approvePaymentTerms((paymentTerms as Record<string, unknown>).id as string)}
                      >
                        Approve Terms
                      </Button>
                    )}
                    {(paymentTerms as Record<string, unknown>).state === "approved" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          const ptId = (paymentTerms as Record<string, unknown>).id as string;
                          activatePaymentTerms(ptId)
                            .then((r) => {
                              if (r.error) toast.error(r.error);
                              else {
                                toast.success("Installments generated.");
                                router.refresh();
                              }
                            })
                            .catch(console.error);
                        }}
                      >
                        Activate & Generate Installments
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Record Paperwork */}
              {state === "completed" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Record Paperwork</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {["invoice", "receipt"].map((dk) => (
                      <Button
                        key={dk}
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const fd = new FormData();
                          fd.set("transaction_id", id);
                          fd.set("document_kind", dk);
                          const result = await recordPaperwork(fd);
                          if (result.error) toast.error(result.error);
                          else {
                            toast.success(`${dk} recorded.`);
                            router.refresh();
                          }
                        }}
                      >
                        <FileText className="mr-1.5 size-3.5" />
                        Record {dk}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === "history" ? (
        <div className="mt-4">
          <Card>
            <CardContent className="py-4">
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No status changes.</p>
              ) : (
                <div className="flex flex-col gap-0">
                  {history.map((entry, index) => (
                    <div key={entry.id as string} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="size-2.5 rounded-full border-2 border-primary" />
                        {index < history.length - 1 && <div className="w-px flex-1 bg-border" />}
                      </div>
                      <div className="pb-5">
                        <p className="font-medium text-sm capitalize">
                          {(entry.to_state as string).replace(/_/g, " ")}
                        </p>
                        {(entry.reason as string) && (
                          <p className="text-muted-foreground text-xs">{entry.reason as string}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {format(new Date(entry.changed_at as string), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeSection === "payments" ? (
        <div className="mt-4">
          <Card>
            <CardContent className="py-4">
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No payments recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left text-muted-foreground">Amount</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Method</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Verified</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id as string} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{formatCurrency(Number(p.amount))}</td>
                        <td className="px-3 py-2 capitalize">{paymentMethodLabel(p.method as string)}</td>
                        <td className="px-3 py-2">{p.settlement_date as string}</td>
                        <td className="px-3 py-2">{p.verified_by ? "✅" : "—"}</td>
                        <td className="px-3 py-2">
                          {!p.verified_by && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const result = await verifyPayment(p.id as string);
                                if (result.error) toast.error(result.error);
                                else {
                                  toast.success("Payment verified.");
                                  router.refresh();
                                }
                              }}
                            >
                              Verify
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeSection === "installments" ? (
        <div className="mt-4">
          <Card>
            <CardContent className="py-4">
              {userRole === "head_accountant" && hasDueOrOverdue ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-destructive text-sm">
                    This account has due or overdue installments. You may instruct a Confidential Informant to repossess
                    the vehicle.
                  </p>
                  <Button size="sm" variant="destructive" onClick={() => setRepoOpen(true)}>
                    Instruct Repossession
                  </Button>
                </div>
              ) : null}
              {!installmentAccount || insts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No installment plan.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Due</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Amount</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">State</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {insts.map((inst: Record<string, unknown>) => (
                      <tr key={inst.id as string} className="border-b last:border-0">
                        <td className="px-3 py-2">{inst.sequence_no as number}</td>
                        <td className="px-3 py-2">{inst.due_date as string}</td>
                        <td className="px-3 py-2 font-medium">{formatCurrency(Number(inst.amount_due))}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={inst.state === "overdue" || inst.state === "due" ? "destructive" : "secondary"}
                          >
                            {inst.state as string}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {inst.state !== "paid" && inst.state !== "waived" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const result = await markInstallmentWaived(inst.id as string);
                                if (result.error) toast.error(result.error);
                                else {
                                  toast.success("Installment waived.");
                                  router.refresh();
                                }
                              }}
                            >
                              Waive
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeSection === "documents" ? (
        <div className="mt-4">
          <Card>
            <CardContent className="flex flex-col gap-4 py-4">
              {kind === "buy" ? (
                <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="purchase-doc-kind">Document</Label>
                    <Select value={docKind} onValueChange={setDocKind}>
                      <SelectTrigger id="purchase-doc-kind" className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="valid_id">Valid ID</SelectItem>
                        <SelectItem value="proof_of_billing">Proof of Billing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {docKind === "valid_id" ? (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="purchase-doc-id-type">ID Type</Label>
                      <Select value={docIdType} onValueChange={setDocIdType}>
                        <SelectTrigger id="purchase-doc-id-type" className="w-44">
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
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
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <Input
                    ref={docFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="w-56"
                  />
                  <Button size="sm" onClick={handleUploadPurchaseDocument}>
                    Upload
                  </Button>
                </div>
              ) : null}
              {documents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No documents.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {documents.map((doc) => (
                    <div key={doc.id as string} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-3">
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="capitalize">{(doc.document_kind as string).replace(/_/g, " ")}</span>
                        {doc.id_type ? (
                          <span className="text-muted-foreground text-xs capitalize">
                            {(doc.id_type as string).replace(/_/g, " ")}
                          </span>
                        ) : null}
                        <Badge variant="secondary" className="text-xs">
                          {doc.verification_state as string}
                        </Badge>
                      </div>
                      {doc.verification_state === "pending" &&
                      ["ceo", "sales_manager", "account_manager"].includes(userRole) ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              const fd = new FormData();
                              fd.set("document_id", doc.id as string);
                              fd.set("decision", "verified");
                              const result = await verifyTransactionDocument(fd);
                              if (result.error) toast.error(result.error);
                              else {
                                toast.success("Document verified.");
                                router.refresh();
                              }
                            }}
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const fd = new FormData();
                              fd.set("document_id", doc.id as string);
                              fd.set("decision", "rejected");
                              const result = await verifyTransactionDocument(fd);
                              if (result.error) toast.error(result.error);
                              else {
                                toast.success("Document rejected.");
                                router.refresh();
                              }
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

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
            <Button variant="destructive" onClick={handleInstructRepossession} disabled={informants.length === 0}>
              {informants.length === 0 ? "No informants available" : "Instruct"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
