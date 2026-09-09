"use client";

import { Card, CardContent } from "@/components/ui/card";

export interface HeadAccountantVehicleSummary {
  total: number;
  totalValue: number;
  avgPrice: number;
  pricedCount: number;
  availableCount: number;
  awaitingCount: number;
  draftCount: number;
  soldCount: number;
  byStatus: Record<string, number>;
}

export function getHeadAccountantVehicleSummary(vehicles: Record<string, unknown>[]): HeadAccountantVehicleSummary {
  const total = vehicles.length;
  const totalValue = vehicles.reduce((sum, v) => sum + (Number(v.current_price) || 0), 0);
  const avgPrice = total ? totalValue / total : 0;
  const byStatus: Record<string, number | undefined> = {};
  for (const v of vehicles) {
    const status = String(v.listing_state ?? "unknown");
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  const pricedCount = vehicles.filter((v) => Number(v.current_price) > 0).length;
  return {
    total,
    totalValue,
    avgPrice,
    pricedCount,
    availableCount: byStatus.available ?? 0,
    awaitingCount: byStatus.awaiting_price_approval ?? 0,
    draftCount: byStatus.draft ?? 0,
    soldCount: byStatus.sold ?? 0,
    byStatus: byStatus as Record<string, number>,
  };
}

export function HeadAccountantVehicleSummary({ vehicles }: { readonly vehicles: Record<string, unknown>[] }) {
  const summary = getHeadAccountantVehicleSummary(vehicles);
  return (
    <div data-testid="ha-vehicle-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Total Vehicles</span>
          <span className="font-semibold text-2xl">{summary.total}</span>
          <span className="text-muted-foreground text-xs">{summary.pricedCount} with price</span>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Inventory Value</span>
          <span className="font-semibold text-2xl">₱{summary.totalValue.toLocaleString()}</span>
          <span className="text-muted-foreground text-xs">Avg ₱{Math.round(summary.avgPrice).toLocaleString()}</span>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Available</span>
          <span className="font-semibold text-2xl">{summary.availableCount}</span>
          <span className="text-muted-foreground text-xs">{summary.soldCount} sold</span>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Awaiting Approval</span>
          <span className="font-semibold text-2xl">{summary.awaitingCount}</span>
          <span className="text-muted-foreground text-xs">{summary.draftCount} draft</span>
        </CardContent>
      </Card>
    </div>
  );
}
