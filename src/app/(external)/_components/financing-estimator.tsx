"use client";

import { useId, useState } from "react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FINANCING_TERM_MONTHS, financedTotal } from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

type Car = { id: string; label: string; price: number };

const TERM_LABEL: Record<number, string> = { 6: "6 mo", 12: "1 yr", 24: "2 yrs", 36: "3 yrs", 60: "5 yrs" };

const peso = (amount: number) => formatCurrency(amount, { noDecimals: true });

// Financing at GCE adds a flat 10% to the car's price, for every term (buy-flow.ts financedTotal).
export function FinancingEstimator({ cars }: { readonly cars: Car[] }) {
  const ids = useId();
  const [carId, setCarId] = useState(cars[0].id);
  const [months, setMonths] = useState("12");

  const car = cars.find((c) => c.id === carId);
  if (!car) return null;
  const total = financedTotal(car.price);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financing estimate</CardTitle>
        <CardDescription>Pick a car and a term.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-car`}>Car</Label>
          <NativeSelect id={`${ids}-car`} value={carId} onChange={(e) => setCarId(e.target.value)} className="w-full">
            {cars.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.label} ({peso(c.price)})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label id={`${ids}-term`}>Term</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={months}
            onValueChange={(value) => value && setMonths(value)}
            aria-labelledby={`${ids}-term`}
            className="w-full"
          >
            {FINANCING_TERM_MONTHS.map((term) => (
              <ToggleGroupItem key={term} value={String(term)} className="flex-1">
                {TERM_LABEL[term]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Separator />
        <dl className="grid grid-cols-2 gap-4" aria-live="polite">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-sm">Total with financing</dt>
            <dd className="font-semibold text-2xl tabular-nums tracking-tight" data-testid="financed-total">
              {peso(total)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-sm">About, per month</dt>
            <dd className="font-semibold text-2xl tabular-nums tracking-tight">
              {peso(Math.ceil(total / Number(months)))}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground text-xs">
          Estimate before your downpayment. GCE sets the downpayment and the final terms when it approves your request.
        </p>
      </CardFooter>
    </Card>
  );
}
