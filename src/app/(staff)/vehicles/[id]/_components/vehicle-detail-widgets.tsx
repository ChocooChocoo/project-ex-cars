import Link from "next/link";

import { format, parseISO } from "date-fns";
import { Car, DollarSign, Gauge, ShieldCheck, Stamp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { listingStateLabel, listingStateVariant } from "@/lib/vehicles/labels";

export interface VehicleDetail {
  id: string;
  stock_code: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  condition: string | null;
  mileage: number | null;
  fuel_type: string | null;
  transmission: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  body_type: string | null;
  engine: string | null;
  description: string | null;
  current_price: number | null;
  pricing_type: string | null;
  warranty_details: string | null;
  offer_details: string | null;
  listing_state: string | null;
  created_at: string | null;
  posted_at: string | null;
}

interface MetricCard {
  label: string;
  value: string;
  icon: typeof Car;
  badge?: { label: string; variant: "default" | "secondary" | "outline" | "destructive" };
  caption: string;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  try {
    return format(parseISO(value), "do MMM yyyy");
  } catch {
    return null;
  }
}

export function VehicleMetricCards({ vehicle }: { readonly vehicle: VehicleDetail }) {
  const cards: MetricCard[] = [
    {
      label: "Listed Price",
      value: vehicle.current_price ? `₱${vehicle.current_price.toLocaleString()}` : "Price TBA",
      icon: DollarSign,
      badge: vehicle.pricing_type ? { label: vehicle.pricing_type, variant: "secondary" } : undefined,
      caption: "As shown to customers",
    },
    {
      label: "Mileage",
      value: vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "—",
      icon: Gauge,
      caption: "Recorded odometer reading",
    },
    {
      label: "Condition",
      value: vehicle.condition ? vehicle.condition.replace(/_/g, " ") : "—",
      icon: ShieldCheck,
      caption: "Inspection grading",
    },
    {
      label: "Listing Status",
      value: listingStateLabel(vehicle.listing_state),
      icon: Car,
      caption: formatDate(vehicle.posted_at)
        ? `Posted ${formatDate(vehicle.posted_at)}`
        : formatDate(vehicle.created_at)
          ? `Added ${formatDate(vehicle.created_at)}`
          : "Not published yet",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle>
                <span className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
              </CardTitle>
              <CardDescription>{card.label}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-3xl capitalize tabular-nums leading-none tracking-tight">
                  {card.value}
                </span>
                {card.badge ? (
                  <Badge variant={card.badge.variant} className="capitalize">
                    {card.badge.label}
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm">{card.caption}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function VehiclePurchaseCard({ vehicle }: { readonly vehicle: VehicleDetail }) {
  const specs: Array<{ label: string; value: string }> = [
    { label: "Condition", value: vehicle.condition ?? "—" },
    { label: "Mileage", value: vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "—" },
    { label: "Transmission", value: vehicle.transmission ?? "—" },
    { label: "Fuel Type", value: vehicle.fuel_type ?? "—" },
    { label: "Body Type", value: vehicle.body_type ?? "—" },
    { label: "Engine", value: vehicle.engine ?? "—" },
    { label: "Exterior Color", value: vehicle.exterior_color ?? "—" },
    { label: "Interior Color", value: vehicle.interior_color ?? "—" },
    { label: "Stock Code", value: vehicle.stock_code ?? "—" },
    { label: "VIN", value: vehicle.vin ?? "—" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {vehicle.make ?? ""} {vehicle.model ?? ""}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{vehicle.year ?? "—"}</Badge>
          <Badge variant={listingStateVariant(vehicle.listing_state)} className="capitalize">
            {listingStateLabel(vehicle.listing_state)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          {vehicle.current_price ? (
            <span className="font-bold text-3xl tabular-nums">₱{vehicle.current_price.toLocaleString()}</span>
          ) : (
            <span className="font-bold text-3xl">Price TBA</span>
          )}
          <Badge variant="secondary" className="ml-2 capitalize">
            {vehicle.pricing_type ?? "negotiable"}
          </Badge>
        </div>
        {vehicle.offer_details ? (
          <Badge variant="outline" className="w-fit text-green-700">
            {vehicle.offer_details}
          </Badge>
        ) : null}
        <Separator />
        <div className="grid grid-cols-2 gap-3 text-sm">
          {specs.map((spec) => (
            <div key={spec.label}>
              <span className="text-muted-foreground">{spec.label}</span>
              <p className="capitalize">{spec.value}</p>
            </div>
          ))}
        </div>
        {vehicle.warranty_details ? (
          <>
            <Separator />
            <div>
              <span className="text-muted-foreground text-sm">Warranty</span>
              <p className="text-sm">{vehicle.warranty_details}</p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function VehicleDescriptionCard({ vehicle }: { readonly vehicle: VehicleDetail }) {
  if (!vehicle.description) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Description</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{vehicle.description}</p>
      </CardContent>
    </Card>
  );
}

export interface PendingProposal {
  id: string;
  proposed_amount: number;
  notes: string | null;
  created_at: string;
}

export function PendingProposalAlert({ proposal }: { readonly proposal: PendingProposal | null }) {
  if (!proposal) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-amber-500/40 bg-background text-amber-600 dark:text-amber-500">
          <Stamp className="size-4" />
        </span>
        <div>
          <p className="font-medium text-sm">Pending price approval</p>
          <p className="text-muted-foreground text-sm">
            ₱{proposal.proposed_amount.toLocaleString()} proposed on {formatDate(proposal.created_at)}
            {proposal.notes ? ` — ${proposal.notes}` : ""}.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href="/dashboard/vehicles">Review in Pending</Link>
      </Button>
    </div>
  );
}
