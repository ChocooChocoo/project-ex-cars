"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import {
  completeReconditioning,
  markPapersProcessed,
  startReconditioning,
  submitReconditioningReport,
} from "@/app/(staff)/vehicles/reconditioning-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

const STATE_LABELS: Record<string, string> = {
  awaiting_report: "Waiting for the status report",
  awaiting_funds: "Waiting for funds",
  in_progress: "Repairs in progress",
  completed: "Ready for repricing",
};

// §6 steps 27–38: a repossessed car's inspection, fund request, repairs, papers and repricing hand-off.
export function ReconditioningPanel({ job, userRole }: { readonly job: Row; readonly userRole: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (key: string) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const state = String(job.state);
  const fundStatus = (job.disbursement_requests as { status?: string } | null)?.status ?? null;
  const funded = ["released", "received", "paid"].includes(fundStatus ?? "");
  const isMechanic = userRole === "mechanic";

  async function submit(action: (fd: FormData) => Promise<Result>, fields: Row, message: string) {
    const fd = new FormData();
    fd.set("job_id", String(job.id));
    for (const [key, value] of Object.entries(fields)) fd.set(key, String(value ?? ""));
    setBusy(true);
    const result = await action(fd);
    setBusy(false);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(message);
      setForm({});
      router.refresh();
    }
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
              <dt className="text-muted-foreground text-xs">Parts and repairs needed</dt>
              <dd className="whitespace-pre-line">{String(job.required_parts ?? "")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Estimated restoration cost</dt>
              <dd>
                {formatCurrency(Number(job.estimated_cost ?? 0))} · fund {fundStatus ?? "not requested"}
              </dd>
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

        <p className="text-muted-foreground text-xs">
          Papers:{" "}
          {job.papers_processed_at
            ? `re-processed ${format(new Date(job.papers_processed_at as string), "MMM d, yyyy")}`
            : "not re-processed yet"}
        </p>

        {isMechanic && state === "awaiting_report" ? (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <Label htmlFor="recon-report">Overall Vehicle Status Report</Label>
            <Textarea
              id="recon-report"
              rows={3}
              value={form.status_report ?? ""}
              onChange={(e) => set("status_report")(e.target.value)}
            />
            <Label htmlFor="recon-parts">Damaged or missing parts, repairs needed</Label>
            <Textarea
              id="recon-parts"
              rows={3}
              value={form.required_parts ?? ""}
              onChange={(e) => set("required_parts")(e.target.value)}
            />
            <Label htmlFor="recon-estimate">Estimated restoration cost (₱)</Label>
            <Input
              id="recon-estimate"
              type="number"
              min="0"
              value={form.estimated_cost ?? ""}
              onChange={(e) => set("estimated_cost")(e.target.value)}
            />
            <Button
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() =>
                submit(
                  submitReconditioningReport,
                  {
                    status_report: form.status_report,
                    required_parts: form.required_parts,
                    estimated_cost: form.estimated_cost,
                  },
                  "Report sent; fund request raised.",
                )
              }
            >
              Submit report and request funds
            </Button>
          </section>
        ) : null}

        {isMechanic && state === "awaiting_funds" ? (
          <Button
            size="sm"
            className="self-start"
            disabled={busy || !funded}
            onClick={() => submit(startReconditioning, {}, "Repairs started.")}
          >
            {funded ? "Start repairs" : "Waiting for the Head Accountant to release funds"}
          </Button>
        ) : null}

        {isMechanic && state === "in_progress" ? (
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
