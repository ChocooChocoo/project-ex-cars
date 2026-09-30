"use client";

import { useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import {
  confirmFieldCheck,
  fileFieldExpense,
  reportInspection,
} from "@/app/(staff)/field-cases/sell-inspection-actions";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { transactionDocumentLabel } from "@/lib/transactions/document-media";
import { SELL_MEETUP_METHOD_LABELS, type SellMeetupMethod } from "@/lib/transactions/sell-flow";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

export function SellMeetupCase({
  fieldCase,
  transaction,
  sellDetails,
  documents,
  expenses,
  userRole,
  userId,
}: {
  readonly fieldCase: Row;
  readonly transaction: Row;
  readonly sellDetails: Row | null;
  readonly documents: Row[];
  readonly expenses: Row[];
  readonly userRole: string;
  readonly userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [issue, setIssue] = useState("");
  const [estimate, setEstimate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const photosRef = useRef<HTMLInputElement>(null);
  const proofRef = useRef<HTMLInputElement>(null);

  const caseId = fieldCase.id as string;
  const isAssigned = fieldCase.assigned_confidential_informant === userId || fieldCase.mechanic_id === userId;
  const isInformant = userRole === "confidential_informant" && fieldCase.assigned_confidential_informant === userId;
  const isMechanic = userRole === "mechanic" && fieldCase.mechanic_id === userId;
  const open = !["completed", "cancelled"].includes(fieldCase.state as string);
  const vehicle = transaction.vehicles as Row | null;
  const seller = transaction.profiles as Row | null;
  const method = sellDetails?.meetup_method as SellMeetupMethod | undefined;
  const checksDone = Boolean(fieldCase.identity_confirmed_at && fieldCase.plate_confirmed_at);

  async function send(action: (fd: FormData) => Promise<Result>, fd: FormData, message: string) {
    fd.set("field_case_id", caseId);
    setBusy(true);
    const result = await action(fd);
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    toast.success(message);
    router.refresh();
    return true;
  }

  function check(kind: "identity" | "plate") {
    const fd = new FormData();
    fd.set("check", kind);
    void send(confirmFieldCheck, fd, kind === "identity" ? "Identity confirmed." : "Plate and chassis confirmed.");
  }

  async function submitInspection() {
    const fd = new FormData();
    fd.set("outcome", outcome);
    fd.set("issue_description", issue);
    fd.set("repair_estimate", estimate);
    for (const file of Array.from(photosRef.current?.files ?? [])) fd.append("photos", file);
    await send(reportInspection, fd, "Inspection reported.");
  }

  async function submitExpense() {
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("description", description);
    const proof = proofRef.current?.files?.[0];
    if (proof) fd.set("proof", proof);
    if (await send(fileFieldExpense, fd, "Expense filed.")) {
      setAmount("");
      setDescription("");
      if (proofRef.current) proofRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/field-cases" className="text-muted-foreground text-sm underline">
          Back to field cases
        </Link>
        <h1 className="text-3xl leading-none tracking-tight">Seller meet-up</h1>
        <p className="text-muted-foreground text-sm">
          {fieldCase.schedule ? format(new Date(fieldCase.schedule as string), "MMM d, yyyy h:mm a") : "No schedule"} ·{" "}
          {String(fieldCase.location ?? "No location")} ·{" "}
          {method ? SELL_MEETUP_METHOD_LABELS[method] : "Method not set"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Case pack</CardTitle>
            <CardDescription>Everything the field team needs before meeting the seller.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Seller: </span>
              {String(seller?.full_name ?? "—")} {seller?.phone ? `· ${seller.phone}` : ""}
            </p>
            <p>
              <span className="text-muted-foreground">Vehicle: </span>
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.stock_code})` : "—"}
              {vehicle?.mileage ? ` · ${Number(vehicle.mileage).toLocaleString()} km` : ""}
            </p>
            <p>
              <span className="text-muted-foreground">Agreed price: </span>
              {sellDetails?.agreed_price ? formatCurrency(Number(sellDetails.agreed_price)) : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Declared issues: </span>
              {sellDetails?.has_known_issues ? String(sellDetails.declared_issues ?? "") : "No known issue"}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {documents.map((doc) => {
                const label = transactionDocumentLabel(doc.document_kind);
                const url = typeof doc.signed_url === "string" ? doc.signed_url : null;
                return (
                  <div key={doc.id as string} className="flex flex-col gap-1 rounded-md border p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs">{label}</span>
                      <Badge variant="secondary" className="text-[11px]">
                        {String(doc.verification_state)}
                      </Badge>
                    </div>
                    {url && doc.is_image === true ? (
                      <TransactionImagePreview src={url} alt={`${label} preview`} />
                    ) : url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="text-primary text-xs underline">
                        Open
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>On-site checks</CardTitle>
              <CardDescription>
                The Confidential Informant confirms the seller matches the verified ID; the Mechanic confirms the plate
                and chassis match the ORCR.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>Seller identity</span>
                {fieldCase.identity_confirmed_at ? (
                  <Badge>Confirmed</Badge>
                ) : isInformant && open ? (
                  <Button size="sm" disabled={busy} onClick={() => check("identity")}>
                    Confirm identity
                  </Button>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Plate / chassis vs ORCR</span>
                {fieldCase.plate_confirmed_at ? (
                  <Badge>Confirmed</Badge>
                ) : isMechanic && open ? (
                  <Button size="sm" disabled={busy} onClick={() => check("plate")}>
                    Confirm plate
                  </Button>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inspection</CardTitle>
              <CardDescription>
                If an issue is found, call the Marketing Specialist, then report it here with photos.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {fieldCase.inspection_outcome ? (
                <p>
                  {fieldCase.inspection_outcome === "no_issues"
                    ? "No issues found. The car is cleared for payment."
                    : `Issue: ${fieldCase.issue_description} (estimated repair ${formatCurrency(Number(fieldCase.repair_estimate ?? 0))})`}
                </p>
              ) : isMechanic && open ? (
                <>
                  {!checksDone ? (
                    <p className="text-muted-foreground text-xs">Finish both on-site checks first.</p>
                  ) : null}
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger aria-label="Inspection outcome">
                      <SelectValue placeholder="Outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_issues">No issues found</SelectItem>
                      <SelectItem value="issue_found">Issue found</SelectItem>
                    </SelectContent>
                  </Select>
                  {outcome === "issue_found" ? (
                    <>
                      <Label htmlFor="issue">Issue found</Label>
                      <Textarea id="issue" rows={2} value={issue} onChange={(e) => setIssue(e.target.value)} />
                      <Label htmlFor="estimate">Estimated total repair cost (₱)</Label>
                      <Input
                        id="estimate"
                        type="number"
                        min="0"
                        value={estimate}
                        onChange={(e) => setEstimate(e.target.value)}
                      />
                    </>
                  ) : null}
                  <Label htmlFor="inspection-photos">Inspection photos</Label>
                  <Input
                    id="inspection-photos"
                    ref={photosRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                  />
                  <Button
                    size="sm"
                    className="self-start"
                    disabled={busy || !outcome || !checksDone}
                    onClick={submitInspection}
                  >
                    Report inspection
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Not reported yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meet-up expenses</CardTitle>
              <CardDescription>
                Required from each field worker, whether or not GCE bought the car. Attach a proof for each.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {expenses.map((expense) => (
                <div
                  key={expense.id as string}
                  className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
                >
                  <span>
                    {String(expense.description)} · {formatCurrency(Number(expense.amount))}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {expense.reimbursed_at ? "Reimbursed" : "Awaiting reimbursement"}
                  </span>
                </div>
              ))}
              {expenses.length === 0 ? <p className="text-muted-foreground">No expenses filed yet.</p> : null}
              {isAssigned && open ? (
                <div className="flex flex-col gap-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Amount (₱)"
                      aria-label="Expense amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <Input
                      placeholder="e.g. Fuel and toll"
                      aria-label="Expense description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <Input
                    ref={proofRef}
                    type="file"
                    aria-label="Proof of expense"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                  />
                  <Button size="sm" className="self-start" disabled={busy} onClick={submitExpense}>
                    File expense
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
