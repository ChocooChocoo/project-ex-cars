"use client";

import { useState } from "react";

import { CircleCheck, ClipboardList, FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  BUYING_PAYMENT_OPTIONS,
  BUYING_RECEIVING_OPTIONS,
  type BuyingPayment,
  type BuyingReceiving,
  buyingRequirements,
} from "@/lib/transactions/buying-requirements";

// T12: the buyer picks the payment method first, then the receiving method, then sees what to prepare.
export function RequirementsPicker() {
  const [payment, setPayment] = useState<BuyingPayment | "">("");
  const [receiving, setReceiving] = useState<BuyingReceiving | "">("");
  const requirements = payment && receiving ? buyingRequirements(payment, receiving) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="size-4 text-muted-foreground" />
          What you need for your purchase
        </CardTitle>
        <CardDescription>Choose how you will pay, then how you will receive the car.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 md:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium text-sm">1. Payment method</legend>
            <RadioGroup
              value={payment}
              onValueChange={(value) => setPayment(value as BuyingPayment)}
              aria-label="Payment method"
            >
              {BUYING_PAYMENT_OPTIONS.map((option) => (
                <ChoiceRow key={option.value} name="payment" option={option} />
              ))}
            </RadioGroup>
          </fieldset>
          <fieldset className="flex flex-col gap-2" disabled={!payment}>
            <legend className="mb-2 font-medium text-sm">2. Receiving method</legend>
            <RadioGroup
              value={receiving}
              onValueChange={(value) => setReceiving(value as BuyingReceiving)}
              aria-label="Receiving method"
              disabled={!payment}
            >
              {BUYING_RECEIVING_OPTIONS.map((option) => (
                <ChoiceRow key={option.value} name="receiving" option={option} disabled={!payment} />
              ))}
            </RadioGroup>
            {payment ? null : <p className="text-muted-foreground text-xs">Choose a payment method first.</p>}
          </fieldset>
        </div>

        <section aria-live="polite" className="flex flex-col gap-3">
          <h2 className="font-medium text-sm">3. Requirements</h2>
          {requirements ? (
            <div className="grid gap-4 md:grid-cols-2">
              <RequirementList
                title="Documents"
                icon={<FileText className="size-4" />}
                items={requirements.documents}
              />
              <RequirementList
                title="Information and payments"
                icon={<ClipboardList className="size-4" />}
                items={requirements.information}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Your requirements appear here after you choose both methods.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function ChoiceRow({
  name,
  option,
  disabled = false,
}: {
  readonly name: string;
  readonly option: { value: string; label: string; detail: string };
  readonly disabled?: boolean;
}) {
  const id = `${name}-${option.value}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 has-disabled:cursor-not-allowed has-data-[state=checked]:border-primary has-disabled:opacity-60"
    >
      <RadioGroupItem id={id} value={option.value} disabled={disabled} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{option.label}</span>
        <span className="text-muted-foreground text-xs">{option.detail}</span>
      </span>
    </label>
  );
}

function RequirementList({
  title,
  icon,
  items,
}: {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly items: string[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="flex items-center gap-2 font-medium text-sm">
        {icon}
        {title}
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
