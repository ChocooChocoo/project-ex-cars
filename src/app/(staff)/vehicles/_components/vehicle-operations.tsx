"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { PendingApprovalsTable, type PriceProposalRow } from "./price-approvals";
import { VehicleTable } from "./vehicles-table";

export function VehicleOperations({
  proposals,
  vehicles,
  canManage,
}: {
  readonly proposals: PriceProposalRow[];
  readonly vehicles: Record<string, unknown>[];
  readonly canManage: boolean;
}) {
  const [segment, setSegment] = useState<"pending" | "vehicles">(proposals.length > 0 ? "pending" : "vehicles");

  return (
    <div className="flex flex-col gap-4">
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
      {segment === "pending" ? (
        <PendingApprovalsTable proposals={proposals} />
      ) : (
        <VehicleTable vehicles={vehicles} canManage={canManage} />
      )}
    </div>
  );
}
