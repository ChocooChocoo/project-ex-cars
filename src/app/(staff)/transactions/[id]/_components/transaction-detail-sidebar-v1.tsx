"use client";
"use no memo";

import { useRef, useState } from "react";

import { format } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCEPTED_ID_TYPES, ID_LABELS } from "@/lib/auth/roles";
import { arrangementKindLabel, TRANSACTION_STATE_LABELS } from "@/lib/transactions/labels";
import type { TransactionState } from "@/lib/transactions/state-machine";
import { formatCurrency } from "@/lib/utils";

export function TransactionDetailSidebarV1({
  kind,
  state,
  userRole,
  payments,
  documents,
  history,
  installmentAccount,
  paymentTerms,
  viewingArrangements,
  informants,
  sellDetails,
  onRecordPayment,
  onReviewSell,
  onUploadDocument,
  onVerifyDocument,
  onRejectDocument,
  onApprovePaymentTerms,
  onActivatePaymentTerms,
  onRecordPaperwork,
  onWaiveInstallment,
  onInstructRepossession,
}: {
  readonly kind: string;
  readonly state: string;
  readonly userRole: string;
  readonly payments: Record<string, unknown>[];
  readonly documents: Record<string, unknown>[];
  readonly history: Record<string, unknown>[];
  readonly installmentAccount: Record<string, unknown> | null;
  readonly paymentTerms: Record<string, unknown> | null;
  readonly viewingArrangements: Record<string, unknown>[];
  readonly informants: { id: string; full_name: string | null }[];
  readonly sellDetails: Record<string, unknown> | undefined;
  readonly onRecordPayment: (amount: string, method: string, date: string) => Promise<void>;
  readonly onReviewSell: (decision: string, valuation: string, notes: string) => Promise<void>;
  readonly onUploadDocument: (documentKind: string, idType: string, file: File) => Promise<void>;
  readonly onVerifyDocument: (documentId: string) => Promise<void>;
  readonly onRejectDocument: (documentId: string) => Promise<void>;
  readonly onApprovePaymentTerms: () => Promise<void>;
  readonly onActivatePaymentTerms: () => Promise<void>;
  readonly onRecordPaperwork: (documentKind: string) => Promise<void>;
  readonly onWaiveInstallment: (installmentId: string) => Promise<void>;
  readonly onInstructRepossession: (informantId: string, reason: string) => Promise<void>;
}) {
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [valuation, setValuation] = useState(sellDetails?.valuation_amount ? String(sellDetails.valuation_amount) : "");
  const [reviewNotes, setReviewNotes] = useState((sellDetails?.review_notes as string) ?? "");
  const [docKind, setDocKind] = useState("valid_id");
  const [docIdType, setDocIdType] = useState("");
  const docFileRef = useRef<HTMLInputElement>(null);
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoInformant, setRepoInformant] = useState("");
  const [repoReason, setRepoReason] = useState("");

  const insts = installmentAccount
    ? (((installmentAccount as Record<string, unknown>).installments as Record<string, unknown>[]) ?? [])
    : [];
  const hasDueOrOverdue = insts.some(
    (inst: Record<string, unknown>) => inst.state === "due" || inst.state === "overdue",
  );
  const tState = state as TransactionState;
  const pt = paymentTerms as Record<string, unknown>;

  async function handleUpload() {
    const file = docFileRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file to upload.");
      return;
    }
    if (docKind === "valid_id" && !docIdType) {
      toast.error("Select the ID type.");
      return;
    }
    await onUploadDocument(docKind, docIdType, file);
    if (docFileRef.current) docFileRef.current.value = "";
  }

  async function handleInstruct() {
    if (!repoInformant) {
      toast.error("Select a Confidential Informant.");
      return;
    }
    await onInstructRepossession(repoInformant, repoReason);
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
                <Badge className="h-5 px-2 text-[11px] tabular-nums">{insts.length} total</Badge>
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

          <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">Documents</p>
              <Badge className="h-5 px-2 text-[11px] tabular-nums">{documents.length}</Badge>
            </div>
            {kind === "buy" && (
              <div className="flex flex-col gap-2">
                <Select
                  value={docKind}
                  onValueChange={(v) => {
                    setDocKind(v);
                    if (v !== "valid_id") setDocIdType("");
                  }}
                >
                  <SelectTrigger className="h-7 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valid_id">Valid ID</SelectItem>
                    <SelectItem value="proof_of_billing">Proof of Billing</SelectItem>
                  </SelectContent>
                </Select>
                {docKind === "valid_id" ? (
                  <Select value={docIdType} onValueChange={setDocIdType}>
                    <SelectTrigger className="h-7 w-full text-xs">
                      <SelectValue placeholder="ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCEPTED_ID_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ID_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  ref={docFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="h-7 w-full text-xs"
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleUpload}>
                  Upload
                </Button>
              </div>
            )}
            {documents.length === 0 ? (
              <p className="text-muted-foreground text-xs">No documents.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id as string} className="space-y-1 rounded-md border bg-background/70 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm capitalize">
                      {(doc.document_kind as string).replace(/_/g, " ")}
                    </span>
                    <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                      {doc.verification_state as string}
                    </Badge>
                  </div>
                  {doc.id_type ? (
                    <p className="text-muted-foreground text-xs capitalize">
                      {(doc.id_type as string).replace(/_/g, " ")}
                    </p>
                  ) : null}
                  {doc.verification_state === "pending" &&
                  ["ceo", "sales_manager", "account_manager"].includes(userRole) ? (
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-6 px-2 text-xs" onClick={() => onVerifyDocument(doc.id as string)}>
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => onRejectDocument(doc.id as string)}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

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

          {["approved", "completed"].includes(tState) && (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Record payment</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pay_amount" className="text-xs">
                  Amount (₱)
                </Label>
                <Input
                  id="pay_amount"
                  type="number"
                  className="h-7 text-xs"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pay_method" className="text-xs">
                  Method
                </Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger id="pay_method" className="h-7 w-full text-xs">
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
              <Button
                size="sm"
                className="h-7 w-full text-xs"
                onClick={() => onRecordPayment(payAmount, payMethod, payDate)}
              >
                Record Payment
              </Button>
            </div>
          )}

          {kind === "buy" && paymentTerms && (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Payment terms</p>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-background/70 px-2.5 py-1.5">
                <span className="font-medium text-sm tabular-nums">{formatCurrency(Number(pt.total_amount))}</span>
                <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                  {pt.state as string}
                </Badge>
              </div>
              {pt.state === "proposed" && (
                <Button size="sm" className="h-7 w-full text-xs" onClick={() => onApprovePaymentTerms()}>
                  Approve Terms
                </Button>
              )}
              {pt.state === "approved" && (
                <Button size="sm" className="h-7 w-full text-xs" onClick={() => onActivatePaymentTerms()}>
                  Activate & Generate Installments
                </Button>
              )}
            </div>
          )}

          {tState === "completed" && (
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

          {kind === "sell" && sellDetails && !sellDetails.decision && userRole === "sales_manager" && (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-muted-foreground text-xs">Review sell offer</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="valuation" className="text-xs">
                  Valuation (₱)
                </Label>
                <Input
                  id="valuation"
                  type="number"
                  className="h-7 text-xs"
                  value={valuation}
                  onChange={(e) => setValuation(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review_notes" className="text-xs">
                  Notes
                </Label>
                <Input
                  id="review_notes"
                  className="h-7 text-xs"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-6 flex-1 px-2 text-xs"
                  onClick={() => onReviewSell("accepted", valuation, reviewNotes)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 flex-1 px-2 text-xs"
                  onClick={() => onReviewSell("rejected", valuation, reviewNotes)}
                >
                  Reject
                </Button>
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
