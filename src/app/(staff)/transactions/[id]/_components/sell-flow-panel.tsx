"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import {
  createInspectionIssueReport,
  flagSellSubmission,
  proposePurchaseCeiling,
  recordAgreedPrice,
  recordSellerResponse,
} from "@/app/(staff)/transactions/sell-actions";
import { approvePrice } from "@/app/(staff)/vehicles/actions";
import { TransactionStatusBadge } from "@/components/transaction-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approvedCeiling,
  PROPOSAL_KIND_LABELS,
  SELL_MEETUP_METHOD_LABELS,
  type SellMeetupMethod,
  sellPapersVerified,
} from "@/lib/transactions/sell-flow";
import type { FlowStatus, TransactionFlag, TransactionState } from "@/lib/transactions/state-machine";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Person = { id: string; full_name: string | null };

export interface SellFlowData {
  readonly proposals: Row[];
  readonly fieldCase: Row | null;
  readonly issueReport: Row | null;
  readonly expenses: Row[];
  readonly threadId: string | null;
  readonly mechanics: Person[];
}

// Next step for each stage, so every viewer sees where the offer stands (GCE Process Flows §1).
function stageGuidance(state: TransactionState, data: SellFlowData, sell: Row | undefined): string {
  if (state === "pending") return "Step 2: the Marketing Specialist verifies the IDs, ORCR and deed of sale.";
  if (state === "under_review") return "Waiting for the CEO to decide the proposed ceiling (7-day window).";
  if (state === "approved") {
    if (sell?.cleared_for_payment_at) return "Cleared for payment. Request the purchase funds in Finance.";
    if (!data.fieldCase) return "Step 5: negotiate in the chat within the ceiling, then record the agreed price.";
    if (!data.fieldCase.inspection_outcome) return "Step 6: the field team meets the seller and inspects the car.";
    if (!data.issueReport) return "Step 7: the Marketing Specialist files the Inspection Issue Report.";
    return "Step 9: the Mechanic presents the revised price; record the seller's answer.";
  }
  return "This sell offer has ended.";
}

async function run(action: (fd: FormData) => Promise<{ error: string } | { success: true }>, fields: Row) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, String(value ?? ""));
  const result = await action(fd);
  if ("error" in result) {
    toast.error(result.error);
    return false;
  }
  return true;
}

export function SellFlowPanel({
  transaction,
  sellDetails,
  documents,
  userRole,
  informants,
  data,
}: {
  readonly transaction: Row;
  readonly sellDetails: Row | undefined;
  readonly documents: Row[];
  readonly userRole: string;
  readonly informants: Person[];
  readonly data: SellFlowData;
}) {
  const router = useRouter();
  const id = transaction.id as string;
  const state = (transaction.current_state ?? "pending") as TransactionState;
  const isMs = userRole === "marketing_specialist";
  const isCeo = userRole === "ceo";
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (key: string) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(
    action: (fd: FormData) => Promise<{ error: string } | { success: true }>,
    fields: Row,
    message: string,
  ) {
    setBusy(true);
    const ok = await run(action, { transaction_id: id, ...fields });
    setBusy(false);
    if (ok) {
      toast.success(message);
      setForm({});
      router.refresh();
    }
  }

  const papersOk = sellPapersVerified(documents as { document_kind: unknown; verification_state: unknown }[]);
  const pendingProposal = data.proposals.find((p) => p.decision === "pending");
  const ceiling = approvedCeiling(
    data.proposals as { proposal_kind: unknown; decision: unknown; proposed_amount: unknown; created_at: unknown }[],
  );
  const method = sellDetails?.meetup_method as SellMeetupMethod | undefined;
  const fieldCase = data.fieldCase;
  const report = data.issueReport;
  const reportProposal = data.proposals.find((p) => p.id === report?.proposal_id);

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Sell offer
          <TransactionStatusBadge
            state={state}
            flowStatus={transaction.flow_status as FlowStatus | null}
            flag={transaction.flag as TransactionFlag | null}
            reviewDueAt={transaction.review_due_at as string | null}
          />
        </CardTitle>
        <CardDescription>{stageGuidance(state, data, sellDetails)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <Fact label="Seller's asking price" value={formatCurrency(Number(sellDetails?.offered_amount ?? 0))} />
          <Fact label="Meet-up method" value={method ? SELL_MEETUP_METHOD_LABELS[method] : "Not given"} />
          <Fact label="Approved ceiling" value={ceiling === null ? "—" : formatCurrency(ceiling)} />
          <Fact
            label="Agreed price"
            value={sellDetails?.agreed_price ? formatCurrency(Number(sellDetails.agreed_price)) : "—"}
          />
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-xs">Declared issues</dt>
            <dd>
              {sellDetails?.has_known_issues === true
                ? String(sellDetails.declared_issues ?? "")
                : sellDetails?.has_known_issues === false
                  ? "No known issue"
                  : "Not declared"}
            </dd>
          </div>
        </dl>

        {data.threadId ? (
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link href={`/dashboard/inquiries/${data.threadId}`}>Open negotiation chat</Link>
          </Button>
        ) : null}

        {isMs && state === "pending" ? (
          <section className="flex flex-col gap-3 rounded-md border p-3">
            <p className="font-medium">Verify and propose</p>
            <p className="text-muted-foreground text-xs">
              {papersOk
                ? "Papers verified. Check the ORCR matches the car and owner, then propose the ceiling."
                : "Verify two valid IDs, the ORCR and the deed of sale in Documents first."}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Purchase ceiling (₱)" htmlFor="ceiling-amount">
                <Input
                  id="ceiling-amount"
                  type="number"
                  min="0"
                  value={form.amount ?? ""}
                  onChange={(e) => set("amount")(e.target.value)}
                />
              </Field>
              <Field label="Notes for the CEO" htmlFor="ceiling-notes">
                <Input id="ceiling-notes" value={form.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} />
              </Field>
            </div>
            <Button
              size="sm"
              className="self-start"
              disabled={busy || !papersOk}
              onClick={() =>
                submit(proposePurchaseCeiling, { amount: form.amount, notes: form.notes }, "Ceiling sent to the CEO.")
              }
            >
              Propose ceiling to CEO
            </Button>
            <Field label="Reason (flag or reject)" htmlFor="flag-reason">
              <Textarea
                id="flag-reason"
                rows={2}
                value={form.reason ?? ""}
                onChange={(e) => set("reason")(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => submit(flagSellSubmission, { outcome: "flag", reason: form.reason }, "Offer flagged.")}
              >
                Flag
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  submit(flagSellSubmission, { outcome: "reject", reason: form.reason }, "Offer rejected.")
                }
              >
                Reject
              </Button>
            </div>
          </section>
        ) : null}

        {isCeo && state === "under_review" && pendingProposal ? (
          <section className="flex flex-col gap-3 rounded-md border p-3">
            <p className="font-medium">
              {PROPOSAL_KIND_LABELS[pendingProposal.proposal_kind as string]}:{" "}
              {formatCurrency(Number(pendingProposal.proposed_amount))}
            </p>
            {pendingProposal.notes ? (
              <p className="text-muted-foreground text-xs">{String(pendingProposal.notes)}</p>
            ) : null}
            <div className="flex gap-2">
              {(["approved", "rejected"] as const).map((decision) => (
                <Button
                  key={decision}
                  size="sm"
                  variant={decision === "approved" ? "default" : "destructive"}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const fd = new FormData();
                    fd.set("proposal_id", pendingProposal.id as string);
                    fd.set("decision", decision);
                    const result = await approvePrice(fd);
                    setBusy(false);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success(`Ceiling ${decision}.`);
                      router.refresh();
                    }
                  }}
                >
                  {decision === "approved" ? "Approve" : "Reject"}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        {isMs && state === "approved" && !fieldCase ? (
          <section className="flex flex-col gap-3 rounded-md border p-3">
            <p className="font-medium">Record the agreed price</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                label={`Agreed price (₱, max ${ceiling === null ? "—" : formatCurrency(ceiling)})`}
                htmlFor="agreed"
              >
                <Input
                  id="agreed"
                  type="number"
                  min="0"
                  value={form.agreed_price ?? ""}
                  onChange={(e) => set("agreed_price")(e.target.value)}
                />
              </Field>
              <Field label="Meet-up date and time" htmlFor="meetup-schedule">
                <Input
                  id="meetup-schedule"
                  type="datetime-local"
                  value={form.schedule ?? ""}
                  onChange={(e) => set("schedule")(e.target.value)}
                />
              </Field>
              <Field label="Meet-up location" htmlFor="meetup-location">
                <Input
                  id="meetup-location"
                  value={form.location ?? (method === "gce_visit" ? "GCE" : "")}
                  onChange={(e) => set("location")(e.target.value)}
                />
              </Field>
              <PersonSelect
                label="Confidential Informant"
                people={informants}
                value={form.informant_id}
                onChange={set("informant_id")}
              />
              <PersonSelect
                label="Mechanic (optional)"
                people={data.mechanics}
                value={form.mechanic_id}
                onChange={set("mechanic_id")}
              />
            </div>
            <Button
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() =>
                submit(
                  recordAgreedPrice,
                  {
                    agreed_price: form.agreed_price,
                    schedule: form.schedule ? new Date(form.schedule).toISOString() : "",
                    location: form.location ?? (method === "gce_visit" ? "GCE" : ""),
                    informant_id: form.informant_id,
                    mechanic_id: form.mechanic_id,
                  },
                  "Price recorded. Field case created.",
                )
              }
            >
              Create field case
            </Button>
          </section>
        ) : null}

        {fieldCase ? (
          <section className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">Field inspection</p>
              <Badge variant="secondary" className="capitalize">
                {String(fieldCase.state).replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              Identity {fieldCase.identity_confirmed_at ? "confirmed" : "not confirmed"} · Plate/chassis{" "}
              {fieldCase.plate_confirmed_at ? "confirmed" : "not confirmed"}
            </p>
            <p>
              {fieldCase.inspection_outcome === "no_issues"
                ? "No issues found."
                : fieldCase.inspection_outcome === "issue_found"
                  ? `Issue: ${fieldCase.issue_description} (repair estimate ${formatCurrency(Number(fieldCase.repair_estimate ?? 0))})`
                  : "Inspection not reported yet."}
            </p>
            <Link href={`/dashboard/field-cases/${fieldCase.id}`} className="text-primary text-xs underline">
              Open field case
            </Link>
          </section>
        ) : null}

        {isMs && state === "approved" && fieldCase?.inspection_outcome === "issue_found" && !report ? (
          <section className="flex flex-col gap-3 rounded-md border p-3">
            <p className="font-medium">Inspection Issue Report</p>
            <p className="text-muted-foreground text-xs">Photos of the issue are under Documents (Inspection photo).</p>
            <Field label="Is the vehicle still profitable?" htmlFor="profitable">
              <Select value={form.is_profitable ?? ""} onValueChange={set("is_profitable")}>
                <SelectTrigger id="profitable">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Still profitable</SelectItem>
                  <SelectItem value="no">No longer profitable</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Explanation" htmlFor="profit-reason">
              <Textarea
                id="profit-reason"
                rows={2}
                value={form.profitability_reason ?? ""}
                onChange={(e) => set("profitability_reason")(e.target.value)}
              />
            </Field>
            {form.is_profitable === "yes" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Recalculated price (₱)" htmlFor="recalculated">
                  <Input
                    id="recalculated"
                    type="number"
                    min="0"
                    value={form.recalculated_price ?? ""}
                    onChange={(e) => set("recalculated_price")(e.target.value)}
                  />
                </Field>
                <Field label="New ceiling (₱)" htmlFor="new-ceiling">
                  <Input
                    id="new-ceiling"
                    type="number"
                    min="0"
                    value={form.new_ceiling ?? ""}
                    onChange={(e) => set("new_ceiling")(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
            <Button
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() =>
                submit(
                  createInspectionIssueReport,
                  {
                    is_profitable: form.is_profitable,
                    profitability_reason: form.profitability_reason,
                    recalculated_price: form.recalculated_price,
                    new_ceiling: form.new_ceiling,
                  },
                  form.is_profitable === "yes" ? "Revised ceiling sent to the CEO." : "Offer cancelled.",
                )
              }
            >
              {form.is_profitable === "no" ? "Cancel the offer" : "Send to CEO"}
            </Button>
          </section>
        ) : null}

        {report ? (
          <section className="flex flex-col gap-1.5 rounded-md border p-3">
            <p className="font-medium">Inspection Issue Report</p>
            <p>{String(report.issue_found)}</p>
            <p className="text-muted-foreground text-xs">
              Repair estimate {formatCurrency(Number(report.repair_estimate))} ·{" "}
              {report.is_profitable ? "Still profitable" : "Not profitable"}: {String(report.profitability_reason)}
            </p>
            {report.is_profitable ? (
              <p className="text-xs">
                Recalculated {formatCurrency(Number(report.recalculated_price))} · New ceiling{" "}
                {formatCurrency(Number(report.new_ceiling))}
                {report.seller_response ? ` · Seller ${String(report.seller_response)}` : ""}
              </p>
            ) : null}
            {isMs && state === "approved" && reportProposal?.decision === "approved" && !report.seller_response ? (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => submit(recordSellerResponse, { response: "agreed" }, "Seller's agreement recorded.")}
                >
                  Seller agrees
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => submit(recordSellerResponse, { response: "refused" }, "Seller's refusal recorded.")}
                >
                  Seller refuses
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {data.proposals.length > 0 ? (
          <section className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs">Ceiling history</p>
            {data.proposals.map((p) => (
              <div
                key={p.id as string}
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
              >
                <span>
                  {PROPOSAL_KIND_LABELS[p.proposal_kind as string]} · {formatCurrency(Number(p.proposed_amount))}
                </span>
                <Badge variant={p.decision === "rejected" ? "destructive" : "secondary"} className="capitalize">
                  {String(p.decision)}
                </Badge>
              </div>
            ))}
          </section>
        ) : null}

        {data.expenses.length > 0 ? (
          <section className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs">Meet-up expenses (proofs under Documents)</p>
            {data.expenses.map((e) => (
              <div
                key={e.id as string}
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
              >
                <span>
                  {String(e.description)} · {formatCurrency(Number(e.amount))}
                </span>
                <span className="text-muted-foreground text-xs">
                  {e.reimbursed_at
                    ? `Reimbursed ${format(new Date(e.reimbursed_at as string), "MMM d")}`
                    : "Not reimbursed"}
                </span>
              </div>
            ))}
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
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
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
