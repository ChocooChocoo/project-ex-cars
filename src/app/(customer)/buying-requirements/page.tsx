import Link from "next/link";

import { CircleCheck, FileText, HandCoins, MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCEPTED_ID_TYPES, ID_LABELS } from "@/lib/auth/roles";

const STEPS = [
  {
    step: "Step 1",
    title: "Prepare two valid IDs",
    details:
      "GCE needs two different valid IDs from the list below. They must be current (not expired), clearly readable, and in your name. Bring the originals and have clear photos or photocopies ready to upload.",
  },
  {
    step: "Step 2",
    title: "Prepare one proof of billing",
    details:
      "Bring one recent proof of billing in your name, such as an electric, water, or internet bill. Staff must verify it before your purchase can be completed.",
  },
  {
    step: "Step 3",
    title: "View the car and agree on payment",
    details:
      "Browse the showroom, view the car in person, then agree on the price. You can pay in cash, through financing, by cheque, or with a down payment.",
  },
  {
    step: "Step 4",
    title: "Choose how to receive the car",
    details:
      "Pick delivery, a CALABARZON meet-up, or a visit to GCE. Your purchase is completed only after staff verify your two IDs and proof of billing, then approve the transaction.",
  },
] as const;

const PAYMENT_METHODS = [
  { label: "Cash", detail: "Pay the full amount at once." },
  { label: "Financing", detail: "Pay in monthly installments with GCE terms." },
  { label: "Cheque", detail: "Pay by cheque on the agreed date." },
  { label: "Down payment", detail: "Pay part now and settle the balance as agreed." },
] as const;

const ARRANGEMENTS = [
  { label: "Delivery", detail: "GCE brings the car to your address." },
  { label: "CALABARZON meet-up", detail: "Meet GCE at an agreed place within CALABARZON only." },
  { label: "GCE visit", detail: "Pick up the car at the GCE office." },
] as const;

export default function BuyingRequirementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Buying Guide</h1>
          <p className="text-muted-foreground text-sm">
            What to prepare before you visit GCE to buy a vehicle. Follow the steps in order.
          </p>
        </div>
        <Button asChild>
          <Link href="/showroom" className="gap-2">
            <Search className="size-4" />
            Browse Showroom
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {STEPS.map((s, index) => (
          <Card key={s.title}>
            <CardHeader>
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {s.step} of {STEPS.length}
              </p>
              <CardTitle className="text-lg">
                {index + 1}. {s.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.details}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="size-4 text-muted-foreground" />
            Accepted valid IDs
          </CardTitle>
          <CardDescription>
            You need two different IDs from this list. Staff verify both before your purchase can be completed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ACCEPTED_ID_TYPES.map((idType) => (
              <li key={idType} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <CircleCheck className="size-4 shrink-0 text-emerald-600" />
                {ID_LABELS[idType]}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HandCoins className="size-4 text-muted-foreground" />
              Payment methods
            </CardTitle>
            <CardDescription>Agree on one of these with GCE staff when you buy.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {PAYMENT_METHODS.map((method) => (
                <li key={method.label} className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
                  <span className="font-medium text-sm">{method.label}</span>
                  <span className="text-muted-foreground text-xs">{method.detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="size-4 text-muted-foreground" />
              Receiving the car
            </CardTitle>
            <CardDescription>Choose one arrangement. Meet-ups are within CALABARZON only.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {ARRANGEMENTS.map((arrangement) => (
                <li key={arrangement.label} className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
                  <span className="font-medium text-sm">{arrangement.label}</span>
                  <span className="text-muted-foreground text-xs">{arrangement.detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
