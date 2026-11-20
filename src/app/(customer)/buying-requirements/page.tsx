import Link from "next/link";

import { CircleCheck, FileText, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCEPTED_ID_TYPES, ID_LABELS } from "@/lib/auth/roles";

import { RequirementsPicker } from "./_components/requirements-picker";

const STEPS = [
  {
    step: "Step 1",
    title: "Prepare two valid IDs",
    details:
      "Prepare two different valid IDs. Bring the originals and two printed back-to-back photocopies of each ID, each copy signed three times. Both IDs must come from the list below, current (not expired) and in your name.",
  },
  {
    step: "Step 2",
    title: "Prepare one proof of billing",
    details:
      "Prepare one recent proof of billing in your name (electric, water or internet bill). Staff must verify it before your purchase can be completed.",
  },
  {
    step: "Step 3",
    title: "View the car and agree on payment",
    details:
      "Browse the showroom and agree on the price. Pay in cash, by bank transfer through PayMongo, or through In-House Financing (the Showroom price plus GCE's financing charge, over 6 to 60 months). Bring your latest payslip; GCE checks it during the financing review.",
  },
  {
    step: "Step 4",
    title: "Choose how to receive the car",
    details:
      "Pick a GCE visit, a meet-up within CALABARZON, or delivery. Use the checklist below to see what your choice needs. Staff verify your documents before they approve the purchase.",
  },
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

      <RequirementsPicker />
    </div>
  );
}
