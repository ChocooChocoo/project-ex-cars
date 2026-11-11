"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { instructRepossession } from "@/app/(staff)/transactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { missedInstallments } from "@/lib/transactions/buy-flow";
import { consecutiveMissedPayments } from "@/lib/transactions/recovery";
import { formatCurrency } from "@/lib/utils";

type Vehicle = { year: number; make: string; model: string } | null;
type Party = { profiles: { full_name: string | null } | null; vehicles: Vehicle } | null;

type Account = {
  id: string;
  purchase_transaction_id: string;
  financed_total?: number | string | null;
  transactions: Party;
  installments: { state: string; due_date: string }[];
};

/** T10: a car bought outright (cash or bank transfer); it counts as sold inventory too. */
export type CashSale = {
  id: string;
  completed_at: string | null;
  profiles: { full_name: string | null } | null;
  vehicles: Vehicle;
  purchase_details: { payment_method: string | null; final_price: number | string | null } | null;
};

type Worker = { account_id: string; role: string; full_name: string | null };
type Recovery = { id: string; transaction_id: string | null };
type Filter = "all" | "cash" | "financing";

const vehicleName = (vehicle: Vehicle) => (vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Vehicle");

// T10: the Head Accountant's "Sold Inventory": every car GCE sold, bought outright or on a financing plan.
// The financing plan rows keep their payment progress and towing request; the filter narrows by payment type.
export function FinancingMonitor({
  accounts,
  cashSales = [],
  workers,
  cases,
  canRequest,
  error,
}: {
  readonly accounts: Account[];
  readonly cashSales?: CashSale[];
  readonly workers: Worker[];
  readonly cases: Recovery[];
  readonly canRequest: boolean;
  readonly error?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

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

  const showFinancing = filter !== "cash";
  const showCash = filter !== "financing";
  const count = (showFinancing ? accounts.length : 0) + (showCash ? cashSales.length : 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">Sold Inventory</h1>
          </CardTitle>
          <CardDescription>
            Cars GCE has sold, paid in full or on a financing plan. Financing plan rows show the buyer's payment
            progress.
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="tabular-nums">
              {count} {count === 1 ? "car" : "cars"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleGroup
            type="single"
            variant="outline"
            value={filter}
            onValueChange={(value) => value && setFilter(value as Filter)}
            aria-label="Payment type"
            className="self-start"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="cash">Cash</ToggleGroupItem>
            <ToggleGroupItem value="financing">Financing</ToggleGroupItem>
          </ToggleGroup>
          {error ? <p role="alert">Unable to load the sold inventory: {error}</p> : null}
          {!error && count === 0 ? <p className="text-muted-foreground text-sm">No sold cars in this view.</p> : null}
          {count > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Payment type</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Payment status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showFinancing
                  ? accounts.map((account) => {
                      const tx = account.transactions;
                      const rows = account.installments ?? [];
                      const next = [...rows]
                        .filter((row) => !["paid", "waived"].includes(row.state))
                        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
                      const consecutive = consecutiveMissedPayments(rows);
                      const missed = missedInstallments(rows);
                      const recovery = cases.find((row) => row.transaction_id === account.purchase_transaction_id);
                      return (
                        <TableRow key={account.id}>
                          <TableCell>{tx?.profiles?.full_name ?? "Client"}</TableCell>
                          <TableCell>{vehicleName(tx?.vehicles ?? null)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Financing</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {account.financed_total ? formatCurrency(Number(account.financed_total)) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="tabular-nums">
                              Paid {rows.filter((row) => row.state === "paid").length} of {rows.length}
                            </span>{" "}
                            · Next due {next?.due_date ?? "none"}
                            {missed > 0 ? <span className="text-destructive"> · Missed {missed}</span> : null}
                            {consecutive >= 4 ? (
                              <Badge variant="destructive" className="ml-2">
                                4 missed in a row
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {recovery ? (
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/dashboard/field-cases/${recovery.id}`}>Open recovery case</Link>
                              </Button>
                            ) : canRequest ? (
                              <Button
                                size="sm"
                                disabled={consecutive < 4}
                                onClick={() => setSelected(account.purchase_transaction_id)}
                              >
                                Request towing
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : null}
                {showCash
                  ? cashSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{sale.profiles?.full_name ?? "Client"}</TableCell>
                        <TableCell>{vehicleName(sale.vehicles)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            Cash{sale.purchase_details?.payment_method === "bank_transfer" ? " (bank transfer)" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {sale.purchase_details?.final_price
                            ? formatCurrency(Number(sale.purchase_details.final_price))
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          Paid in full
                          {sale.completed_at ? ` · sold ${sale.completed_at.slice(0, 10)}` : ""}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
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
