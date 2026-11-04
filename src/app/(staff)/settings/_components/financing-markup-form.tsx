"use client";

import { useId, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { financedTotal } from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

import { updateFinancingMarkup } from "../actions";

export function FinancingMarkupForm({ initialPct }: { readonly initialPct: number }) {
  const id = useId();
  const [value, setValue] = useState(String(initialPct));
  const [saved, setSaved] = useState(initialPct);
  const [busy, setBusy] = useState(false);
  const pct = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(pct) && pct >= 0 && pct <= 100;

  async function save() {
    setBusy(true);
    const result = await updateFinancingMarkup(value);
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setSaved(result.pct);
    toast.success(`Financing profit set to ${result.pct}%.`);
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Financing profit</CardTitle>
        <CardDescription>
          GCE adds this percentage to the car's price for In-House Financing, for every term. New offers use the new
          figure; terms already proposed keep theirs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label htmlFor={id}>Profit (%)</Label>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.5}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={!valid}
          className="max-w-40"
        />
        <p className="text-muted-foreground text-sm">
          {valid
            ? `Example: a ${formatCurrency(1_000_000, { noDecimals: true })} car financed costs ${formatCurrency(financedTotal(1_000_000, pct), { noDecimals: true })}.`
            : "Enter a number from 0 to 100."}
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={busy || !valid || pct === saved}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </CardFooter>
    </Card>
  );
}
