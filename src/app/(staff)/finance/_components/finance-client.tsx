"use client";
"use no memo";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Banknote, Check, ChevronRight, Plus, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { confirmBudgetReturn } from "@/app/(staff)/field-cases/budget-actions";
import {
  advanceDisbursement,
  createDisbursementRequest,
  recordFinancialEntry,
  requestPurchaseFunds,
  verifyFinancialEntry,
} from "@/app/(staff)/finance/actions";
import { TablePager, usePagedRows } from "@/components/table-pager";
import { InspectionResult, type InspectionResultData } from "@/components/transactions/inspection-result";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency, toCents } from "@/lib/utils";
import { FINANCIAL_ENTRY_KINDS, type FinancialEntryKind } from "@/lib/validation/phase6";

export interface FinancialEntryRow {
  id: string;
  entry_kind: FinancialEntryKind;
  amount_cents: number;
  description: string;
  verified_by: string | null;
  recorded_at: string;
  /** SN-10: the source of an automatic movement, so the row links back to the car or the field case. */
  transaction_id?: string | null;
  field_case_id?: string | null;
}

/** SN-9: what a fund request is actually about, as the Finance page reads it beside the request. */
export interface DisbursementContext {
  transaction: { id: string; kind: string; state: string; arrangement: string | null };
  vehicle: {
    stock_code: string;
    year: number;
    make: string;
    model: string;
    condition: string | null;
    listing_state: string | null;
  } | null;
  party: { role: "seller" | "buyer"; name: string | null };
  prices: { agreed_cents: number | null; final_cents: number | null; requested_cents: number };
  payment: {
    option: string | null;
    method: string | null;
    received_cents: number;
    downpayment: { amount_cents: number | null; status: string };
    delivery_fee: { amount_cents: number | null; status: string };
  };
  issues: { condition: string | null; has_known_issues: boolean | null; declared_issues: string | null } | null;
  /** SH-3: the seller meet-up inspection, serialised once by VehicleInspection::pack(). */
  inspection: InspectionResultData | null;
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
  /** T10: a Confidential Informant's field budget, with the excess returned after the trip. */
  field_case_id?: string | null;
  returned_cents?: number | null;
  returned_at?: string | null;
  return_confirmed_at?: string | null;
  /** BH-4: why the Head Accountant rejected it, shown to the person who asked. */
  rejection_reason?: string | null;
  context?: DisbursementContext | null;
}

/** SN-10: opening balance plus every posted movement, as Laravel sums it. */
export interface CashOnHand {
  opening_cents: number;
  movements_cents: number;
  total_cents: number;
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
  /** T10: the Head Accountant confirms a field budget's returned excess. */
  canConfirmReturn?: boolean;
  /** SN-10: opening balance plus movements, summed by Laravel. Omitted keeps the client's own sum. */
  cashOnHand?: CashOnHand | null;
}

const ENTRY_LABELS: Record<FinancialEntryKind, string> = {
  revenue: "Revenue",
  expense: "Expense",
  disbursement: "Disbursement",
  adjustment: "Adjustment",
};

const DISBURSEMENT_FLOW: Record<string, { label: string; next: string | null }> = {
  // Requests are created as drafts; the server moves draft → approved, so the button must too.
  draft: { label: "Draft", next: "approved" },
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

export function getFinanceSummary(entries: FinancialEntryRow[]) {
  const revenueTotal = entries.filter((e) => e.entry_kind === "revenue").reduce((sum, e) => sum + e.amount_cents, 0);
  const expenseTotal = entries.filter((e) => e.entry_kind === "expense").reduce((sum, e) => sum + e.amount_cents, 0);
  return { revenueTotal, expenseTotal, netTotal: revenueTotal - expenseTotal, count: entries.length };
}

/**
 * SN-10 sign convention, the one Laravel's Ledger applies: `amount_cents` is always a positive magnitude, and the
 * entry kind decides the direction. Revenue and adjustment put money in the drawer, expense and disbursement take
 * it out. Cash on hand = the opening balance plus the sum of these effects.
 */
const ENTRY_SIGN: Record<FinancialEntryKind, 1 | -1> = {
  revenue: 1,
  adjustment: 1,
  expense: -1,
  disbursement: -1,
};

/** The signed cash effect of one entry, in centavos. */
export function entryEffectCents(entry: FinancialEntryRow): number {
  return ENTRY_SIGN[entry.entry_kind] * entry.amount_cents;
}

/** Opening balance plus every movement, or Laravel's own figures when the page sent them. */
export function cashOnHandCents(entries: FinancialEntryRow[], cashOnHand?: CashOnHand | null): number {
  if (cashOnHand) return cashOnHand.total_cents;
  return entries.reduce((total, entry) => total + entryEffectCents(entry), 0);
}

const isOutflow = (kind: FinancialEntryKind) => ENTRY_SIGN[kind] === -1;

function LedgerTable({
  entries,
  canVerify,
  onVerify,
}: {
  readonly entries: FinancialEntryRow[];
  readonly canVerify: boolean;
  readonly onVerify: (entry: FinancialEntryRow) => void;
}) {
  const paged = usePagedRows(entries);
  return (
    <div>
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
              paged.rows.map((entry) => (
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
                      isOutflow(entry.entry_kind)
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400",
                    )}
                  >
                    {formatCurrency(entryEffectCents(entry) / 100)}
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
                        <Button variant="ghost" size="sm" onClick={() => onVerify(entry)}>
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
      <TablePager {...paged} label="Financial entries" />
    </div>
  );
}

/**
 * SN-10: the movements list — date, type, amount, reason and a link to the car or field case that caused it.
 * Automatic entries point at their source; a manual entry has none, so it stays plain text.
 */
function MovementsTable({ entries }: { readonly entries: FinancialEntryRow[] }) {
  const paged = usePagedRows(entries);
  const href = (entry: FinancialEntryRow) =>
    entry.transaction_id
      ? `/dashboard/transactions/${entry.transaction_id}`
      : entry.field_case_id
        ? `/dashboard/field-cases/${entry.field_case_id}`
        : null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="px-2 py-2 font-medium">Reason</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                  No money movements recorded yet.
                </td>
              </tr>
            ) : (
              paged.rows.map((entry) => {
                const link = href(entry);
                return (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="px-2 py-2 text-muted-foreground">
                      {new Date(entry.recorded_at).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant="secondary" className="capitalize">
                        {ENTRY_LABELS[entry.entry_kind]}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{entry.description}</td>
                    <td
                      className={cn(
                        "px-2 py-2 text-right font-medium tabular-nums",
                        isOutflow(entry.entry_kind)
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400",
                      )}
                    >
                      {formatCurrency(entryEffectCents(entry) / 100)}
                    </td>
                    <td className="px-2 py-2">
                      {link ? (
                        <Link href={link} className="text-primary underline underline-offset-4">
                          Open
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <TablePager {...paged} label="Money movements" />
    </div>
  );
}

/** A charge the deal does or does not owe, and whether its money is confirmed. */
function ChargeLine({
  label,
  charge,
}: {
  readonly label: string;
  readonly charge: { amount_cents: number | null; status: string };
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>
        {charge.status === "not_required" ? (
          <span className="text-muted-foreground">Not required</span>
        ) : (
          <>
            {formatCurrency(Number(charge.amount_cents ?? 0) / 100)}{" "}
            <Badge variant={charge.status === "paid" ? "default" : "outline"} className="capitalize">
              {charge.status}
            </Badge>
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * SN-9 / BH-4 / SH-3: the car, the deal, the parties, the prices and the payment status of a fund request, with
 * the seller meet-up inspection result for a purchase, so the Head Accountant decides without leaving the page.
 */
function FundContext({ context }: { readonly context: DisbursementContext }) {
  const { transaction, vehicle, party, prices, payment, issues, inspection } = context;
  const arrangement =
    transaction.kind === "sell"
      ? transaction.arrangement === "gce_visit"
        ? "GCE Visit"
        : "Meet Halfway"
      : (transaction.arrangement ?? "GCE Visit").replace(/_/g, " ");
  return (
    <section className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Vehicle"}
          {vehicle?.stock_code ? <span className="text-muted-foreground"> · {vehicle.stock_code}</span> : null}
        </p>
        <Link
          href={`/dashboard/transactions/${transaction.id}`}
          className="text-primary text-xs underline underline-offset-4"
        >
          Open transaction
        </Link>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-xs">Transaction</dt>
          <dd>{`${transaction.kind === "sell" ? "Sell" : "Buy"} · ${arrangement}`}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{party.role === "seller" ? "Seller" : "Buyer"}</dt>
          <dd>{party.name ?? "—"}</dd>
        </div>
        {prices.agreed_cents !== null ? (
          <div>
            <dt className="text-muted-foreground text-xs">Agreed price</dt>
            <dd className="tabular-nums">{formatCurrency(prices.agreed_cents / 100)}</dd>
          </div>
        ) : null}
        {prices.final_cents !== null ? (
          <div>
            <dt className="text-muted-foreground text-xs">Final price</dt>
            <dd className="tabular-nums">{formatCurrency(prices.final_cents / 100)}</dd>
          </div>
        ) : null}
        {payment.option || payment.method ? (
          <div>
            <dt className="text-muted-foreground text-xs">Payment</dt>
            <dd className="capitalize">
              {[payment.option === "full" ? "Full payment" : payment.option, payment.method?.replace(/_/g, " ")]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        ) : null}
        {payment.received_cents > 0 ? (
          <div>
            <dt className="text-muted-foreground text-xs">Received so far</dt>
            <dd className="tabular-nums">{formatCurrency(payment.received_cents / 100)}</dd>
          </div>
        ) : null}
        <ChargeLine label="Downpayment" charge={payment.downpayment} />
        <ChargeLine label="Delivery fee" charge={payment.delivery_fee} />
      </dl>
      {issues ? (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">Condition and declared issues</p>
          <p className="text-sm">
            {[issues.condition, issues.has_known_issues ? "Declared issues" : "No declared issues"]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {issues.declared_issues ? <p className="text-sm">{issues.declared_issues}</p> : null}
        </div>
      ) : null}
      {inspection ? <InspectionResult result={inspection} title="Inspection on site" /> : null}
    </section>
  );
}

const statusVariant = (status: string) => (status === "rejected" || status === "paid" ? "secondary" : "default");

function DisbursementsTable({
  disbursements,
  onOpen,
}: {
  readonly disbursements: DisbursementRow[];
  readonly onOpen: (row: DisbursementRow) => void;
}) {
  const paged = usePagedRows(disbursements);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-2 py-2 font-medium">Title</th>
              <th className="px-2 py-2 font-medium">Amount</th>
              <th className="px-2 py-2 font-medium">Purpose</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="w-8 px-2 py-2">
                <span className="sr-only">Details</span>
              </th>
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
              paged.rows.map((row) => (
                // T03 HA4: the whole row opens the request; the title button is the keyboard target.
                <tr
                  key={row.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                  onClick={() => onOpen(row)}
                >
                  <td className="px-2 py-2 font-medium">
                    <button
                      type="button"
                      className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open ${row.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(row);
                      }}
                    >
                      {row.title}
                    </button>
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {formatCurrency(row.amount_cents / 100, { noDecimals: true })}
                  </td>
                  <td className="max-w-64 truncate px-2 py-2 text-muted-foreground">{row.purpose}</td>
                  <td className="px-2 py-2">
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePager {...paged} label="Disbursement requests" />
    </div>
  );
}

function DisbursementDetail({
  row,
  canAdvance,
  reason,
  onReasonChange,
  busy,
  onAdvance,
  canConfirmReturn = false,
  onConfirmReturn,
}: {
  readonly row: DisbursementRow;
  readonly canConfirmReturn?: boolean;
  readonly onConfirmReturn?: () => void;
  readonly canAdvance: boolean;
  readonly reason: string;
  readonly onReasonChange: (value: string) => void;
  readonly busy: boolean;
  readonly onAdvance: (eventKind: string, notes?: string) => void;
}) {
  // A field budget ends at release: the Confidential Informant spends it and returns the excess.
  const fieldBudgetOut = Boolean(row.field_case_id) && ["released", "received", "paid"].includes(row.status);
  const flow = fieldBudgetOut ? undefined : DISBURSEMENT_FLOW[row.status];
  const canReject = canAdvance && (row.status === "draft" || row.status === "submitted");
  // BH-3: a zero excess is system-confirmed on the spot, so there is nothing for the Head Accountant to confirm.
  const excessToConfirm = Boolean(row.returned_at && !row.return_confirmed_at && Number(row.returned_cents ?? 0) > 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{row.title}</DialogTitle>
        <DialogDescription>
          Requested {new Date(row.created_at).toLocaleDateString()} ·{" "}
          {formatCurrency(row.amount_cents / 100, { noDecimals: true })}
        </DialogDescription>
      </DialogHeader>

      <dl className="flex flex-col gap-4 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge variant={statusVariant(row.status)}>{flow?.label ?? row.status}</Badge>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Purpose</dt>
          <dd className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3">
            {row.purpose}
          </dd>
        </div>
        {row.rejection_reason ? (
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">Reason for rejecting</dt>
            <dd className="whitespace-pre-wrap break-words rounded-md border border-destructive/40 bg-destructive/5 p-3">
              {row.rejection_reason}
            </dd>
          </div>
        ) : null}
        {row.returned_at ? (
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">Excess returned</dt>
            <dd>
              {Number(row.returned_cents ?? 0) === 0 ? (
                "No excess"
              ) : (
                <>
                  {formatCurrency(Number(row.returned_cents ?? 0) / 100)} ·{" "}
                  {row.return_confirmed_at ? "confirmed" : "waiting for your confirmation"}
                </>
              )}
            </dd>
          </div>
        ) : null}
        {row.notes ? (
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-wrap break-words">{row.notes}</dd>
          </div>
        ) : null}
      </dl>

      {row.context ? <FundContext context={row.context} /> : null}

      {canReject ? (
        <Field>
          <FieldLabel htmlFor="disbursement-reject-reason">Reason for rejecting</FieldLabel>
          <Textarea
            id="disbursement-reject-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Needed only if you reject this request"
          />
        </Field>
      ) : null}

      {!canAdvance && row.status === "draft" ? (
        <p className="text-muted-foreground text-sm">Awaiting approval by finance roles.</p>
      ) : null}

      {canConfirmReturn && excessToConfirm ? (
        <DialogFooter>
          <Button disabled={busy} onClick={onConfirmReturn}>
            Confirm excess received
          </Button>
        </DialogFooter>
      ) : null}

      {canAdvance && flow?.next ? (
        <DialogFooter>
          {canReject ? (
            <Button
              variant="outline"
              disabled={busy || reason.trim().length === 0}
              onClick={() => onAdvance("rejected", reason.trim())}
            >
              <Undo2 data-icon="inline-start" />
              Reject
            </Button>
          ) : null}
          <Button disabled={busy} onClick={() => onAdvance(flow.next ?? "")}>
            {DISBURSEMENT_EVENT_LABELS[flow.next ?? ""]}
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}

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
  canConfirmReturn = false,
  cashOnHand = null,
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
  const [detail, setDetail] = useState<DisbursementRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const { revenueTotal, expenseTotal } = getFinanceSummary(entries);
  // SN-10: Laravel sums the opening balance with every movement; the client can do the same if it says nothing.
  const cash = cashOnHandCents(entries, cashOnHand) / 100;
  const openingCents = cashOnHand ? cashOnHand.opening_cents : 0;
  const movementsCents = cashOnHand
    ? cashOnHand.movements_cents
    : entries.reduce((total, entry) => total + entryEffectCents(entry), 0);
  const pendingApprovals = disbursements.filter(
    (d) => d.status === "submitted" || d.status === "approved" || d.status === "released" || d.status === "received",
  ).length;

  async function submitEntry() {
    setLoading(true);
    setEntryError(null);
    const fd = new FormData();
    fd.set("entry_kind", entryKind);
    fd.set("amount_cents", toCents(entryAmount));
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
    fd.set("amount_cents", toCents(requestAmount));
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
    fd.set("amount_cents", toCents(fundAmount));
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

  async function confirmReturn(disbursementId: string) {
    const fd = new FormData();
    fd.set("disbursement_id", disbursementId);
    setAdvancing(true);
    const result = await confirmBudgetReturn(fd);
    setAdvancing(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Return confirmed.");
    setDetail(null);
    router.refresh();
  }

  async function advance(disbursementId: string, eventKind: string, notes = "") {
    const fd = new FormData();
    fd.set("disbursement_id", disbursementId);
    fd.set("event_kind", eventKind);
    if (notes) fd.set("notes", notes);
    setAdvancing(true);
    const result = await advanceDisbursement(fd);
    setAdvancing(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    // Event kinds are already past tense ("approved", "rejected"); only "paid" needs a verb.
    toast.success(`Disbursement ${eventKind === "paid" ? "marked paid" : eventKind}.`);
    setDetail(null);
    setRejectReason("");
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* SN-10: the drawer total is part of the ledger's audience, so an informant does not see it. */}
        {cashOnHand ? (
          <Card>
            <CardContent className="flex flex-col gap-1 pt-4">
              <span className="text-muted-foreground text-xs">Cash on hand</span>
              <span className={cn("font-semibold text-2xl tabular-nums", cash < 0 && "text-red-600 dark:text-red-400")}>
                {formatCurrency(cash, { noDecimals: true })}
              </span>
            </CardContent>
          </Card>
        ) : null}
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
          {!isInformant ? (
            <TabsTrigger value="summary" className="gap-2">
              <Banknote />
              Summary
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="ledger" className="gap-2">
            <Banknote />
            Ledger
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <Undo2 />
            Movements
          </TabsTrigger>
          <TabsTrigger value="disbursements" className="gap-2">
            <Send />
            Disbursements
          </TabsTrigger>
        </TabsList>

        {!isInformant ? (
          <TabsContent value="summary">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card size="sm">
                <CardContent className="flex flex-col gap-1 pt-3">
                  <span className="text-muted-foreground text-xs">Opening balance</span>
                  <span className="font-semibold text-2xl tabular-nums">
                    {formatCurrency(openingCents / 100, { noDecimals: true })}
                  </span>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent className="flex flex-col gap-1 pt-3">
                  <span className="text-muted-foreground text-xs">Movements</span>
                  <span className={cn("font-semibold text-2xl tabular-nums", movementsCents < 0 && "text-red-600")}>
                    {formatCurrency(movementsCents / 100, { noDecimals: true })}
                  </span>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent className="flex flex-col gap-1 pt-3">
                  <span className="text-muted-foreground text-xs">Cash on hand</span>
                  <span
                    className={cn("font-semibold text-2xl tabular-nums", cash < 0 && "text-red-600 dark:text-red-400")}
                  >
                    {formatCurrency(cash, { noDecimals: true })}
                  </span>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent className="flex flex-col gap-1 pt-3">
                  <span className="text-muted-foreground text-xs">Active Disbursements</span>
                  <span className="font-semibold text-2xl">{pendingApprovals}</span>
                </CardContent>
              </Card>
            </div>
            <p className="mt-3 text-muted-foreground text-xs">
              Opening balance from app_settings.finance_opening_cents plus every posted movement · {entries.length}{" "}
              ledger entries · full list in the Movements tab
            </p>
          </TabsContent>
        ) : null}

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Money movements</CardTitle>
            </CardHeader>
            <CardContent>
              <MovementsTable entries={entries} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle>Financial Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {isInformant ? (
                <details data-testid="informant-ledger">
                  <summary className="cursor-pointer text-muted-foreground text-sm">
                    View full ledger ({entries.length} entries) — collapsed for informant
                  </summary>
                  <div className="mt-4">
                    <LedgerTable entries={entries} canVerify={canVerify} onVerify={setVerifyTarget} />
                  </div>
                </details>
              ) : (
                <LedgerTable entries={entries} canVerify={canVerify} onVerify={setVerifyTarget} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disbursements">
          <Card>
            <CardHeader>
              <CardTitle>Disbursement Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <DisbursementsTable
                disbursements={disbursements}
                onOpen={(row) => {
                  setRejectReason("");
                  setDetail(row);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open && !advancing) setDetail(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {detail ? (
            <DisbursementDetail
              row={detail}
              canAdvance={canAdvance}
              reason={rejectReason}
              onReasonChange={setRejectReason}
              busy={advancing}
              onAdvance={(eventKind, notes) => advance(detail.id, eventKind, notes)}
              canConfirmReturn={canConfirmReturn}
              onConfirmReturn={() => confirmReturn(detail.id)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

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
              <FieldLabel>Transaction</FieldLabel>
              <Select value={fundTransactionId} onValueChange={setFundTransactionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transaction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {purchaseTransactions.map((tx) => (
                      <SelectItem key={tx.id} value={tx.id}>
                        {tx.transaction_kind === "sell" ? "Seller payment" : "Buy"} · {tx.id.slice(0, 8)}…
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
