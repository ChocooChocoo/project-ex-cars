"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { instructRepossession } from "@/app/(staff)/transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { missedInstallments } from "@/lib/transactions/buy-flow";
import { consecutiveMissedPayments } from "@/lib/transactions/recovery";

type Account = {
  id: string;
  purchase_transaction_id: string;
  transactions: {
    profiles: { full_name: string | null } | null;
    vehicles: { year: number; make: string; model: string } | null;
  } | null;
  installments: { state: string; due_date: string }[];
};
type Worker = { account_id: string; role: string; full_name: string | null };
type Recovery = { id: string; transaction_id: string | null };
export function FinancingMonitor({
  accounts,
  workers,
  cases,
  canRequest,
  error,
}: {
  readonly accounts: Account[];
  readonly workers: Worker[];
  readonly cases: Recovery[];
  readonly canRequest: boolean;
  readonly error?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(fd: FormData) {
    fd.set("transaction_id", selected ?? "");
    setBusy(true);
    try {
      const result = await instructRepossession(fd);
      if ("error" in result) toast.error(result.error);
      else {
        setSelected(null);
        router.refresh();
        toast.success("Towing requested.");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Financing monitor</h1>
      {error ? <p role="alert">Unable to load financing: {error}</p> : null}
      {!error && !accounts.length ? <p>No active financing accounts.</p> : null}
      {accounts.map((account) => {
        const tx = account.transactions;
        const rows = account.installments ?? [];
        const next = [...rows]
          .filter((row) => !["paid", "waived"].includes(row.state))
          .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
        const consecutive = consecutiveMissedPayments(rows);
        const recovery = cases.find((row) => row.transaction_id === account.purchase_transaction_id);
        return (
          <section key={account.id} className="space-y-2 rounded-md border p-4">
            <h2 className="font-semibold">
              {tx?.profiles?.full_name ?? "Client"} ·{" "}
              {tx?.vehicles ? `${tx.vehicles.year} ${tx.vehicles.make} ${tx.vehicles.model}` : "Vehicle"}
            </h2>
            <p>
              Paid {rows.filter((row) => row.state === "paid").length} of {rows.length} · Next due:{" "}
              {next?.due_date ?? "None"} · Missed: {missedInstallments(rows)}
            </p>
            {consecutive >= 4 ? <Badge variant="destructive">4 consecutive missed payments</Badge> : null}
            {recovery ? (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/field-cases/${recovery.id}`}>Open recovery case</Link>
              </Button>
            ) : canRequest ? (
              <Button disabled={consecutive < 4} onClick={() => setSelected(account.purchase_transaction_id)}>
                Request towing
              </Button>
            ) : null}
          </section>
        );
      })}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request towing</DialogTitle>
          </DialogHeader>
          <form action={submit} className="space-y-3">
            {[
              { role: "confidential_informant", name: "informant_id", label: "Confidential Informant" },
              { role: "head_security", name: "head_security_id", label: "Head Security" },
            ].map((field) => (
              <div key={field.name}>
                <Label htmlFor={field.name}>{field.label}</Label>
                <select
                  id={field.name}
                  name={field.name}
                  required
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                >
                  <option value="">Choose employee</option>
                  {workers
                    .filter((worker) => worker.role === field.role)
                    .map((worker) => (
                      <option key={worker.account_id} value={worker.account_id}>
                        {worker.full_name ?? worker.account_id}
                      </option>
                    ))}
                </select>
              </div>
            ))}
            <Label htmlFor="tow-reason">Reason</Label>
            <Textarea id="tow-reason" name="reason" required maxLength={4000} />
            <Button disabled={busy} type="submit">
              {busy ? "Requesting..." : "Request towing"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
