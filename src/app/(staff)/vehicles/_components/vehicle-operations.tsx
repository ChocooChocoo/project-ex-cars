"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { PendingApprovalsTable, type PriceProposalRow } from "./price-approvals";
import { VehicleTable } from "./vehicles-table";

export function VehicleOperations({
  proposals,
  vehicles,
}: {
  readonly proposals: PriceProposalRow[];
  readonly vehicles: Record<string, unknown>[];
}) {
  const [segment, setSegment] = useState<"pending" | "vehicles">(proposals.length > 0 ? "pending" : "vehicles");

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        size="sm"
        spacing={0}
        variant="outline"
        value={segment}
        onValueChange={(value) => {
          if (value === "pending" || value === "vehicles") setSegment(value);
        }}
        className="self-start"
      >
        <ToggleGroupItem value="pending">Pending</ToggleGroupItem>
        <ToggleGroupItem value="vehicles">Vehicles</ToggleGroupItem>
      </ToggleGroup>
      {segment === "pending" ? <PendingApprovalsTable proposals={proposals} /> : <VehicleTable vehicles={vehicles} />}
    </div>
  );
}
