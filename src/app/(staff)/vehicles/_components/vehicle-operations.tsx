"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { PendingApprovalsTable, type PriceProposalRow } from "./price-approvals";
import { HeadAccountantVehicleSummary } from "./vehicle-finance-summary";
import { VehicleTable } from "./vehicles-table";

type VehicleQuickFilter = "all" | "available" | "ready" | "on_lot" | "needs_inspection" | "ready_for_pricing";

type ReconditioningSummary = { state: string; papers_processed_at: string | null };

function getVehicleFilterOptions(userRole: string | null) {
  if (userRole === "sales_manager") {
    return [
      { value: "all" as const, label: "All" },
      { value: "available" as const, label: "Available" },
      { value: "ready" as const, label: "Ready to sell" },
    ];
  }
  if (userRole === "head_security") {
    return [
      { value: "all" as const, label: "All" },
      { value: "on_lot" as const, label: "On-lot" },
    ];
  }
  if (userRole === "mechanic") {
    return [
      { value: "all" as const, label: "All" },
      { value: "needs_inspection" as const, label: "Needs inspection" },
    ];
  }
  if (userRole === "marketing_specialist") {
    return [
      { value: "all" as const, label: "All" },
      { value: "ready_for_pricing" as const, label: "Reconditioned — ready for pricing" },
    ];
  }
  return null;
}

export function VehicleOperations({
  proposals,
  vehicles,
  canManage,
  canView,
  isHeadAccountant,
  userRole = null,
  reconditioningByVehicle = {},
}: {
  readonly proposals: PriceProposalRow[];
  readonly vehicles: Record<string, unknown>[];
  readonly canManage: boolean;
  readonly canView: boolean;
  readonly isHeadAccountant?: boolean;
  readonly userRole?: string | null;
  readonly reconditioningByVehicle?: Record<string, ReconditioningSummary>;
}) {
  const [segment, setSegment] = useState<"pending" | "vehicles">(proposals.length > 0 ? "pending" : "vehicles");
  const [vehicleFilter, setVehicleFilter] = useState<VehicleQuickFilter>("all");

  const filterOptions = useMemo(() => getVehicleFilterOptions(userRole), [userRole]);

  const filteredVehicles = useMemo(() => {
    if (!filterOptions || vehicleFilter === "all") return vehicles;
    if (userRole === "sales_manager") {
      if (vehicleFilter === "available") return vehicles.filter((v) => v.listing_state === "available");
      if (vehicleFilter === "ready") {
        return vehicles.filter(
          (v) =>
            v.listing_state === "available" ||
            v.listing_state === "reserved" ||
            v.listing_state === "awaiting_price_approval",
        );
      }
    }
    if (userRole === "head_security" && vehicleFilter === "on_lot") {
      return vehicles.filter((v) => v.listing_state === "available" || v.listing_state === "reserved");
    }
    if (userRole === "mechanic" && vehicleFilter === "needs_inspection") {
      return vehicles.filter((v) => v.listing_state === "inspecting" || v.listing_state === "repairing");
    }
    if (userRole === "marketing_specialist" && vehicleFilter === "ready_for_pricing") {
      return vehicles.filter((v) => {
        const job = reconditioningByVehicle[String(v.id)];
        return v.listing_state === "repairing" && job?.state === "completed" && Boolean(job.papers_processed_at);
      });
    }
    return vehicles;
  }, [vehicles, vehicleFilter, userRole, filterOptions, reconditioningByVehicle]);

  const showVehicleFilter = segment === "vehicles" && filterOptions !== null;

  return (
    <div className="flex flex-col gap-4">
      {isHeadAccountant ? <HeadAccountantVehicleSummary vehicles={vehicles} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          size="sm"
          spacing={1}
          aria-label="Vehicle inventory view"
          value={segment}
          onValueChange={(value) => {
            if (value === "pending" || value === "vehicles") setSegment(value);
          }}
          className="self-start bg-muted p-0.75 text-muted-foreground **:data-[slot=toggle-group-item]:rounded-md **:data-[slot=toggle-group-item]:border **:data-[slot=toggle-group-item]:border-transparent **:data-[slot=toggle-group-item]:text-foreground/60 **:data-[slot=toggle-group-item]:hover:text-foreground [&_[data-slot=toggle-group-item][data-state=on]]:bg-background [&_[data-slot=toggle-group-item][data-state=on]]:text-foreground [&_[data-slot=toggle-group-item][data-state=on]]:shadow-sm dark:[&_[data-slot=toggle-group-item][data-state=on]]:border-input dark:[&_[data-slot=toggle-group-item][data-state=on]]:bg-input/30"
        >
          <ToggleGroupItem value="pending">Pending</ToggleGroupItem>
          <ToggleGroupItem value="vehicles">Vehicles</ToggleGroupItem>
        </ToggleGroup>
        {showVehicleFilter ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {filteredVehicles.length} / {vehicles.length}
          </Badge>
        ) : null}
      </div>
      {showVehicleFilter && filterOptions ? (
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={1}
          aria-label="Quick vehicle filter"
          value={vehicleFilter}
          onValueChange={(value) => {
            if (value) setVehicleFilter(value as VehicleQuickFilter);
          }}
          className="self-start"
          data-testid="vehicle-quick-filter"
        >
          {filterOptions.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
      {segment === "pending" ? (
        <PendingApprovalsTable proposals={proposals} canApprove={!isHeadAccountant} />
      ) : (
        <VehicleTable vehicles={filteredVehicles} canManage={canManage} canView={canView} />
      )}
    </div>
  );
}
