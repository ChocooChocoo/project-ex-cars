"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  completeReconditioning,
  markPapersProcessed,
  markReconditioningRefundReturned,
  requestReconditioningFunds,
  startReconditioning,
  submitReconditioningReport,
} from "@/app/(staff)/vehicles/reconditioning-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { partsTotalCents, releasedFundsCents } from "@/lib/transactions/reconditioning-funds";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

type Receipt = { storage_path: string; signed_url?: string | null };
type FundRequest = {
  id: string;
  amount_cents: number;
  reason: string | null;
  shortfall_reason: string | null;
  state: string;
  disbursement_requests?: { status?: string | null } | null;
  reconditioning_fund_receipts?: Receipt[];
};
type Job = Row & {
  reconditioning_parts?: Array<{
    id: string;
    part_name: string;
    replacement_brand: string;
    estimated_cost_cents: number;
  }>;
  reconditioning_fund_requests?: FundRequest[];
  disbursement_requests?: { status?: string | null; amount_cents?: unknown } | null;
  refund_due_cents?: number | null;
  refunded_at?: string | null;
};

type PartInput = { id: string; part_name: string; replacement_brand: string; estimated_cost: string };

const EMPTY_PART = { part_name: "", replacement_brand: "", estimated_cost: "" };
const newPart = (): PartInput => ({ id: crypto.randomUUID(), ...EMPTY_PART });

const STATE_LABELS: Record<string, string> = {
  awaiting_report: "Waiting for the status report",
  awaiting_funds: "Waiting for funds",
  in_progress: "Repairs in progress",
  completed: "Ready for repricing",
};

// §6 steps 27–38: a repossessed car's inspection, per-part fund request, repairs, papers and repricing.
export function ReconditioningPanel({
  job: rawJob,
  userRole,
}: {
  readonly job: Record<string, unknown>;
  readonly userRole: string;
}) {
  const job = rawJob as Job;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [parts, setParts] = useState<PartInput[]>([newPart()]);
  const [receipts, setReceipts] = useState<File[]>([]);
  const set = (key: string) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const state = String(job.state);
  const isMechanic = userRole === "mechanic";
  const storedParts = job.reconditioning_parts ?? [];
  const fundRequests = job.reconditioning_fund_requests ?? [];
  const released = releasedFundsCents(fundRequests, job.disbursement_requests ?? null);
  const estimated = storedParts.length > 0 ? partsTotalCents(storedParts) : Number(job.estimated_cost ?? 0) * 100;
  const refundDue = Number(job.refund_due_cents ?? 0);
  const totalInput = partsTotalCents(parts);

  async function run(action: (fd: FormData) => Promise<Result>, fd: FormData, message: string) {
    setBusy(true);
    const result = await action(fd);
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(message);
    setForm({});
    setReceipts([]);
    router.refresh();
  }

  function submit(action: (fd: FormData) => Promise<Result>, fields: Row, message: string) {
    const fd = new FormData();
    fd.set("job_id", String(job.id));
    for (const [key, value] of Object.entries(fields)) fd.set(key, String(value ?? ""));
    return run(action, fd, message);
  }

  function setPart(index: number, key: keyof PartInput, value: string) {
    setParts((prev) => prev.map((part, i) => (i === index ? { ...part, [key]: value } : part)));
  }

  function submitReport() {
    const fd = new FormData();
    fd.set("job_id", String(job.id));
    fd.set("status_report", form.status_report ?? "");
    fd.set("parts", JSON.stringify(parts));
    return run(submitReconditioningReport, fd, "Report sent; fund request raised.");
  }

  function submitShortfall() {
    const fd = new FormData();
    fd.set("job_id", String(job.id));
    fd.set("amount", form.fund_amount ?? "");
    fd.set("shortfall_reason", form.fund_reason ?? "");
    for (const file of receipts) fd.append("receipts", file);
    return run(requestReconditioningFunds, fd, "Shortfall request sent to the Head Accountant.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Reconditioning
          <Badge variant={state === "completed" ? "default" : "secondary"}>{STATE_LABELS[state] ?? state}</Badge>
        </CardTitle>
        <CardDescription>
          Repossessed car. The Mechanic reports and restores it, the Sales Manager re-processes the papers, then the
          Marketing Specialist proposes the revised price for the CEO.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {job.status_report ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Overall Vehicle Status Report</dt>
              <dd className="whitespace-pre-line">{String(job.status_report)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Estimated restoration cost</dt>
              <dd>{formatCurrency(estimated / 100)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Released funds</dt>
              <dd>{formatCurrency(released / 100)}</dd>
            </div>
            {job.final_report ? (
              <div>
                <dt className="text-muted-foreground text-xs">Final repair report</dt>
                <dd className="whitespace-pre-line">
                  {String(job.final_report)} ({formatCurrency(Number(job.actual_cost ?? 0))})
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {storedParts.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Part</th>
                  <th className="px-3 py-2 font-medium">Replacement brand</th>
                  <th className="px-3 py-2 text-right font-medium">Estimate</th>
                </tr>
              </thead>
              <tbody>
                {storedParts.map((part) => (
                  <tr key={part.id} className="border-t">
                    <td className="px-3 py-2">{part.part_name}</td>
                    <td className="px-3 py-2">{part.replacement_brand}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(part.estimated_cost_cents / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {fundRequests.length > 0 ? (
          <section className="flex flex-col gap-2">
            <p className="font-medium">Fund requests</p>
            <ul className="flex flex-col gap-2">
              {fundRequests.map((request) => {
                const status = request.disbursement_requests?.status ?? request.state;
                return (
                  <li key={request.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium tabular-nums">{formatCurrency(request.amount_cents / 100)}</span>
                      <Badge variant="outline">{String(status).replace(/_/g, " ")}</Badge>
                    </div>
                    {request.shortfall_reason ? (
                      <p className="mt-1 text-muted-foreground text-xs">{request.shortfall_reason}</p>
                    ) : null}
                    {request.reconditioning_fund_receipts?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {request.reconditioning_fund_receipts.map((receipt) => (
                          <a
                            key={receipt.storage_path}
                            href={receipt.signed_url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-xs underline underline-offset-4"
                          >
                            Receipt
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <p className="text-muted-foreground text-xs">
          Papers:{" "}
          {job.papers_processed_at
            ? `re-processed ${format(new Date(job.papers_processed_at as string), "MMM d, yyyy")}`
            : "not re-processed yet"}
        </p>

        {isMechanic && state === "awaiting_report" ? (
          <section className="flex flex-col gap-3 rounded-md border p-3">
            <Label htmlFor="recon-report">Overall Vehicle Status Report</Label>
            <Textarea
              id="recon-report"
              rows={3}
              value={form.status_report ?? ""}
              onChange={(e) => set("status_report")(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <p className="font-medium">Parts to repair or replace</p>
              {parts.map((part, index) => (
                <div key={part.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_130px_auto]">
                  <Input
                    aria-label={`Part ${index + 1} name`}
                    placeholder="Part name"
                    value={part.part_name}
                    onChange={(e) => setPart(index, "part_name", e.target.value)}
                  />
                  <Input
                    aria-label={`Part ${index + 1} replacement brand`}
                    placeholder="Replacement brand"
                    value={part.replacement_brand}
                    onChange={(e) => setPart(index, "replacement_brand", e.target.value)}
                  />
                  <Input
                    aria-label={`Part ${index + 1} estimated budget`}
                    type="number"
                    min="0"
                    placeholder="Budget (₱)"
                    value={part.estimated_cost}
                    onChange={(e) => setPart(index, "estimated_cost", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove part ${index + 1}`}
                    disabled={parts.length === 1}
                    onClick={() => setParts((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setParts((prev) => [...prev, newPart()])}
                >
                  <Plus className="size-4" />
                  Add part
                </Button>
                <p className="text-muted-foreground text-xs">
                  Estimated total: <span className="font-medium tabular-nums">{formatCurrency(totalInput / 100)}</span>
                </p>
              </div>
            </div>
            <Button size="sm" className="self-start" disabled={busy} onClick={submitReport}>
              Submit report and request funds
            </Button>
          </section>
        ) : null}

        {isMechanic && state === "awaiting_funds" ? (
          <Button
            size="sm"
            className="self-start"
            disabled={busy || released <= 0}
            onClick={() => submit(startReconditioning, {}, "Repairs started.")}
          >
            {released > 0 ? "Start repairs" : "Waiting for the Head Accountant to release funds"}
          </Button>
        ) : null}

        {isMechanic && state === "in_progress" ? (
          <>
            <section className="flex flex-col gap-2 rounded-md border p-3">
              <p className="font-medium">Request more funds</p>
              <Label htmlFor="fund-amount">Extra amount needed (₱)</Label>
              <Input
                id="fund-amount"
                type="number"
                min="0"
                value={form.fund_amount ?? ""}
                onChange={(e) => set("fund_amount")(e.target.value)}
              />
              <Label htmlFor="fund-reason">Why the funds ran short</Label>
              <Textarea
                id="fund-reason"
                rows={2}
                value={form.fund_reason ?? ""}
                onChange={(e) => set("fund_reason")(e.target.value)}
              />
              <Label htmlFor="fund-receipts">Receipt photos</Label>
              <Input
                id="fund-receipts"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => setReceipts(Array.from(e.target.files ?? []))}
              />
              <Button size="sm" className="self-start" disabled={busy} onClick={submitShortfall}>
                Send shortfall request
              </Button>
            </section>

            <section className="flex flex-col gap-2 rounded-md border p-3">
              <Label htmlFor="recon-final">Final repair report</Label>
              <Textarea
                id="recon-final"
                rows={3}
                value={form.final_report ?? ""}
                onChange={(e) => set("final_report")(e.target.value)}
              />
              <Label htmlFor="recon-actual">Actual cost (₱)</Label>
              <Input
                id="recon-actual"
                type="number"
                min="0"
                value={form.actual_cost ?? ""}
                onChange={(e) => set("actual_cost")(e.target.value)}
              />
              <Button
                size="sm"
                className="self-start"
                disabled={busy}
                onClick={() =>
                  submit(
                    completeReconditioning,
                    { final_report: form.final_report, actual_cost: form.actual_cost },
                    "Reconditioning completed.",
                  )
                }
              >
                Complete reconditioning
              </Button>
            </section>
          </>
        ) : null}

        {state === "completed" && refundDue > 0 ? (
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <div>
              <p className="font-medium">Leftover funds to return</p>
              <p className="text-muted-foreground text-xs tabular-nums">{formatCurrency(refundDue / 100)}</p>
            </div>
            {job.refunded_at ? (
              <Badge variant="outline">Returned {format(new Date(job.refunded_at as string), "MMM d, yyyy")}</Badge>
            ) : isMechanic || userRole === "head_accountant" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => submit(markReconditioningRefundReturned, {}, "Leftover marked returned.")}
              >
                Mark leftover returned
              </Button>
            ) : (
              <Badge variant="secondary">Waiting for the Mechanic</Badge>
            )}
          </section>
        ) : null}

        {userRole === "sales_manager" && !job.papers_processed_at ? (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            disabled={busy}
            onClick={() => submit(markPapersProcessed, {}, "Papers marked re-processed.")}
          >
            Mark papers re-processed
          </Button>
        ) : null}

        {userRole === "marketing_specialist" && state === "completed" ? (
          <p className="text-xs">
            {job.papers_processed_at
              ? "Ready: propose the revised price from the vehicle list. It goes to the CEO as a reprice."
              : "Waiting for the Sales Manager to re-process the papers before repricing."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
