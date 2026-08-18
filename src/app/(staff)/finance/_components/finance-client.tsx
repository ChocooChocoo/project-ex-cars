"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Banknote, Check, Plus, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

import {
  advanceDisbursement,
  createDisbursementRequest,
  recordFinancialEntry,
  requestPurchaseFunds,
  verifyFinancialEntry,
} from "@/app/(staff)/finance/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FINANCIAL_ENTRY_KINDS, type FinancialEntryKind } from "@/lib/validation/phase6";

export interface FinancialEntryRow {
  id: string;
  entry_kind: FinancialEntryKind;
  amount_cents: number;
  description: string;
  verified_by: string | null;
  recorded_at: string;
}

export interface DisbursementRow {
  id: string;
  title: string;
  amount_cents: number;
  purpose: string;
  status: string;
  notes: string | null;
  requested_by: string;
  purchase_transaction_id: string | null;
  created_at: string;
}

export interface PurchaseTransactionRow {
  id: string;
  customer_id: string;
  transaction_kind: string;
}

interface FinanceClientProps {
  entries: FinancialEntryRow[];
  disbursements: DisbursementRow[];
  purchaseTransactions: PurchaseTransactionRow[];
  canRecord: boolean;
  canVerify: boolean;
  canRequest: boolean;
  canAdvance: boolean;
  canRequestPurchaseFunds: boolean;
  isInformant: boolean;
}

const ENTRY_LABELS: Record<FinancialEntryKind, string> = {
  revenue: "Revenue",
  expense: "Expense",
  disbursement: "Disbursement",
  adjustment: "Adjustment",
};

const DISBURSEMENT_FLOW: Record<string, { label: string; next: string | null }> = {
  draft: { label: "Draft", next: null },
  submitted: { label: "Submitted", next: "approved" },
  approved: { label: "Approved", next: "released" },
  rejected: { label: "Rejected", next: null },
  released: { label: "Released", next: "received" },
  received: { label: "Received", next: "paid" },
  paid: { label: "Paid", next: null },
};

const DISBURSEMENT_EVENT_LABELS: Record<string, string> = {
  submitted: "Submit",
  approved: "Approve",
  rejected: "Reject",
  released: "Release",
  received: "Receive",
  paid: "Mark Paid",
};

export function FinanceClient({
  entries,
  disbursements,
  purchaseTransactions,
  canRecord,
  canVerify,
  canRequest,
  canAdvance,
  canRequestPurchaseFunds,
  isInformant,
}: FinanceClientProps) {
  const router = useRouter();
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryKind, setEntryKind] = useState<FinancialEntryKind>("revenue");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestPurpose, setRequestPurpose] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundTransactionId, setFundTransactionId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundNotes, setFundNotes] = useState("");
  const [fundError, setFundError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<FinancialEntryRow | null>(null);
  const [verifying, setVerifying] = useState(false);

  const revenueTotal = entries.filter((e) => e.entry_kind === "revenue").reduce((sum, e) => sum + e.amount_cents, 0);
  const expenseTotal = entries.filter((e) => e.entry_kind === "expense").reduce((sum, e) => sum + e.amount_cents, 0);
  const pendingApprovals = disbursements.filter(
    (d) => d.status === "submitted" || d.status === "approved" || d.status === "released" || d.status === "received",
  ).length;

  async function submitEntry() {
    setLoading(true);
    setEntryError(null);
    const fd = new FormData();
    fd.set("entry_kind", entryKind);
    fd.set("amount_cents", entryAmount);
    fd.set("description", entryDescription);
    const result = await recordFinancialEntry(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setEntryError(result.error);
      return;
    }
    toast.success("Financial entry recorded.");
    setEntryOpen(false);
    setEntryAmount("");
    setEntryDescription("");
    router.refresh();
  }

  async function submitRequest() {
    setLoading(true);
    setRequestError(null);
    const fd = new FormData();
    fd.set("title", requestTitle);
    fd.set("amount_cents", requestAmount);
    fd.set("purpose", requestPurpose);
    fd.set("notes", requestNotes);
    const result = await createDisbursementRequest(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setRequestError(result.error);
      return;
    }
    toast.success("Disbursement request submitted.");
    setRequestOpen(false);
    setRequestTitle("");
    setRequestAmount("");
    setRequestPurpose("");
    setRequestNotes("");
    router.refresh();
  }

  async function submitFundRequest() {
    setLoading(true);
    setFundError(null);
    const fd = new FormData();
    fd.set("transaction_id", fundTransactionId);
    fd.set("amount_cents", fundAmount);
    fd.set("notes", fundNotes);
    const result = await requestPurchaseFunds(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFundError(result.error);
      return;
    }
    toast.success("Purchase fund request created. Awaiting Head Accountant release.");
    setFundOpen(false);
    setFundTransactionId("");
    setFundAmount("");
    setFundNotes("");
    router.refresh();
  }

  async function advance(disbursementId: string, eventKind: string) {
    const fd = new FormData();
    fd.set("disbursement_id", disbursementId);
    fd.set("event_kind", eventKind);
    const result = await advanceDisbursement(fd);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Disbursement ${DISBURSEMENT_EVENT_LABELS[eventKind].toLowerCase()}d.`);
    router.refresh();
  }

  async function verify(entryId: string) {
    const fd = new FormData();
    fd.set("entry_id", entryId);
    const result = await verifyFinancialEntry(fd);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return false;
    }
    toast.success("Entry verified.");
    router.refresh();
    return true;
  }

  async function confirmVerify() {
    if (!verifyTarget || verifying) return;
    setVerifying(true);
    const verified = await verify(verifyTarget.id);
    setVerifying(false);
    if (verified) setVerifyTarget(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Finance</h1>
          <p className="text-muted-foreground text-sm">
            Record-only ledger and disbursement tracking. No money moves through the system.
          </p>
        </div>
        <div className="flex gap-2">
          {canRecord ? (
            <Button onClick={() => setEntryOpen(true)}>
              <Plus data-icon="inline-start" />
              Record Entry
            </Button>
          ) : null}
          {canRequest ? (
            <Button variant="outline" onClick={() => setRequestOpen(true)}>
              <Send data-icon="inline-start" />
              Request Disbursement
            </Button>
          ) : null}
          {canRequestPurchaseFunds ? (
            <Button variant="outline" onClick={() => setFundOpen(true)}>
              <Banknote data-icon="inline-start" />
              Request Purchase Funds
            </Button>
          ) : null}
        </div>
      </div>

      {isInformant ? (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-amber-800 text-sm dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
          You are viewing your own disbursement requests. New requests must be advanced by the CEO or Head Accountant.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-muted-foreground text-xs">Revenue</span>
            <span className="font-semibold text-2xl text-green-600 dark:text-green-400">
              ₱{(revenueTotal / 100).toLocaleString()}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-muted-foreground text-xs">Expenses</span>
            <span className="font-semibold text-2xl text-red-600 dark:text-red-400">
              ₱{(expenseTotal / 100).toLocaleString()}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-muted-foreground text-xs">Active Disbursements</span>
            <span className="font-semibold text-2xl">{pendingApprovals}</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ledger" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="ledger" className="gap-2">
            <Banknote />
            Ledger
          </TabsTrigger>
          <TabsTrigger value="disbursements" className="gap-2">
            <Send />
            Disbursements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle>Financial Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Type</th>
                      <th className="px-2 py-2 font-medium">Description</th>
                      <th className="px-2 py-2 font-medium">Amount</th>
                      <th className="px-2 py-2 font-medium">Recorded</th>
                      <th className="px-2 py-2 font-medium">Verified</th>
                      {canVerify ? <th className="px-2 py-2" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={canVerify ? 6 : 5} className="px-2 py-6 text-center text-muted-foreground">
                          No financial entries recorded.
                        </td>
                      </tr>
                    ) : (
                      entries.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="px-2 py-2">
                            <Badge variant="secondary" className="capitalize">
                              {ENTRY_LABELS[entry.entry_kind]}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">{entry.description}</td>
                          <td
                            className={cn(
                              "px-2 py-2 font-medium",
                              entry.entry_kind === "expense" || entry.entry_kind === "disbursement"
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400",
                            )}
                          >
                            {entry.entry_kind === "expense" || entry.entry_kind === "disbursement" ? "−" : "+"}₱
                            {(entry.amount_cents / 100).toLocaleString()}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {new Date(entry.recorded_at).toLocaleDateString()}
                          </td>
                          <td className="px-2 py-2">
                            {entry.verified_by ? (
                              <Badge variant="default">Verified</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </td>
                          {canVerify ? (
                            <td className="px-2 py-2 text-right">
                              {!entry.verified_by ? (
                                <Button variant="ghost" size="sm" onClick={() => setVerifyTarget(entry)}>
                                  <Check data-icon="inline-start" />
                                  Verify
                                </Button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disbursements">
          <Card>
            <CardHeader>
              <CardTitle>Disbursement Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Title</th>
                      <th className="px-2 py-2 font-medium">Amount</th>
                      <th className="px-2 py-2 font-medium">Purpose</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {disbursements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                          No disbursement requests.
                        </td>
                      </tr>
                    ) : (
                      disbursements.map((disbursement) => {
                        const flow = DISBURSEMENT_FLOW[disbursement.status];
                        return (
                          <tr key={disbursement.id} className="border-b last:border-0">
                            <td className="px-2 py-2 font-medium">{disbursement.title}</td>
                            <td className="px-2 py-2">₱{(disbursement.amount_cents / 100).toLocaleString()}</td>
                            <td className="max-w-64 truncate px-2 py-2 text-muted-foreground">
                              {disbursement.purpose}
                            </td>
                            <td className="px-2 py-2">
                              <Badge
                                variant={
                                  disbursement.status === "rejected" || disbursement.status === "paid"
                                    ? "secondary"
                                    : "default"
                                }
                              >
                                {disbursement.status}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-right">
                              {canAdvance && flow.next ? (
                                <div className="flex justify-end gap-2">
                                  {disbursement.status === "draft" || disbursement.status === "submitted" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => advance(disbursement.id, "rejected")}
                                    >
                                      <Undo2 data-icon="inline-start" />
                                      Reject
                                    </Button>
                                  ) : null}
                                  <Button size="sm" onClick={() => advance(disbursement.id, flow.next ?? "")}>
                                    {DISBURSEMENT_EVENT_LABELS[flow.next ?? ""]}
                                  </Button>
                                </div>
                              ) : null}
                              {!canAdvance && disbursement.status === "draft" ? (
                                <span className="text-muted-foreground text-xs">
                                  Awaiting approval by finance roles
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Financial Entry</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select value={entryKind} onValueChange={(value) => setEntryKind(value as FinancialEntryKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FINANCIAL_ENTRY_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind} className="capitalize">
                        {ENTRY_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Amount (₱)</FieldLabel>
              <Input
                type="number"
                min="0"
                value={entryAmount}
                onChange={(e) => setEntryAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} rows={3} />
            </Field>
            {entryError ? <p className="text-destructive text-sm">{entryError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitEntry} disabled={loading}>
              {loading ? "Saving..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Disbursement</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Title</FieldLabel>
              <Input
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="Reconditioning fund"
              />
            </Field>
            <Field>
              <FieldLabel>Amount (₱)</FieldLabel>
              <Input
                type="number"
                min="0"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field>
              <FieldLabel>Purpose</FieldLabel>
              <Textarea value={requestPurpose} onChange={(e) => setRequestPurpose(e.target.value)} rows={3} />
            </Field>
            <Field>
              <FieldLabel>Notes (optional)</FieldLabel>
              <Input value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} />
            </Field>
            {requestError ? <p className="text-destructive text-sm">{requestError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitRequest} disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Purchase Funds</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Buy Transaction</FieldLabel>
              <Select value={fundTransactionId} onValueChange={setFundTransactionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transaction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {purchaseTransactions.map((tx) => (
                      <SelectItem key={tx.id} value={tx.id}>
                        {tx.id.slice(0, 8)}…
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Amount (₱)</FieldLabel>
              <Input
                type="number"
                min="0"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field>
              <FieldLabel>Notes (optional)</FieldLabel>
              <Input value={fundNotes} onChange={(e) => setFundNotes(e.target.value)} />
            </Field>
            {fundError ? <p className="text-destructive text-sm">{fundError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFundOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitFundRequest} disabled={loading || !fundTransactionId}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!verifyTarget}
        onOpenChange={(open) => {
          if (!open && !verifying) setVerifyTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify financial entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark “{verifyTarget?.description}” as verified. Confirm only after reviewing the amount and
              entry details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={verifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVerify} disabled={verifying}>
              {verifying ? "Verifying..." : "Verify entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
