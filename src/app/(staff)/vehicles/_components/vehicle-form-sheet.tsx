"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { VehicleFormData } from "@/lib/validation/vehicles";

import { VehicleForm } from "./vehicle-form";

interface VehicleFormSheetProps {
  open: boolean;
  mode: "add" | "edit";
  vehicle: Record<string, unknown> | null;
  onOpenChange: (open: boolean) => void;
}

function toFormDefaults(vehicle: Record<string, unknown>): VehicleFormData & { id: string } {
  return {
    id: vehicle.id as string,
    stock_code: (vehicle.stock_code as string) ?? "",
    vin: (vehicle.vin as string) ?? "",
    make: (vehicle.make as string) ?? "",
    model: (vehicle.model as string) ?? "",
    year: (vehicle.year as number) ?? new Date().getFullYear(),
    condition: (vehicle.condition as string) ?? "used",
    mileage: (vehicle.mileage as number | undefined) ?? undefined,
    fuel_type: (vehicle.fuel_type as string) ?? "",
    transmission: (vehicle.transmission as string) ?? "",
    exterior_color: (vehicle.exterior_color as string) ?? "",
    interior_color: (vehicle.interior_color as string) ?? "",
    body_type: (vehicle.body_type as string) ?? "",
    engine: (vehicle.engine as string) ?? "",
    description: (vehicle.description as string) ?? "",
    current_price: (vehicle.current_price as number | undefined) ?? undefined,
    pricing_type: (vehicle.pricing_type as VehicleFormData["pricing_type"]) ?? "negotiable",
    warranty_details: (vehicle.warranty_details as string) ?? "",
    offer_details: (vehicle.offer_details as string) ?? "",
  };
}

export function VehicleFormSheet({ open, mode, vehicle, onOpenChange }: VehicleFormSheetProps) {
  const isEdit = mode === "edit";
  const vehicleName = vehicle ? `${(vehicle.make as string) ?? ""} ${(vehicle.model as string) ?? ""}`.trim() : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{isEdit ? "Edit Vehicle" : "Add Vehicle"}</SheetTitle>
          <SheetDescription>
            {isEdit ? (
              <>
                Update vehicle details for <span className="font-medium text-foreground">{vehicleName}</span>.
              </>
            ) : (
              "Add a new vehicle to inventory."
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {open ? (
            <VehicleForm
              defaultValues={isEdit && vehicle ? toFormDefaults(vehicle) : undefined}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
