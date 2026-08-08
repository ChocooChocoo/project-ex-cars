import { notFound } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import type { VehicleFormData } from "@/lib/validation/vehicles";

import { VehicleForm } from "../_components/vehicle-form";
import { type StaffMediaRow, VehicleMediaManager } from "./_components/vehicle-media-manager";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? null;
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).single();

  if (!vehicle) notFound();

  const { data: media } = await supabase
    .from("vehicle_media")
    .select("id, media_kind, storage_path, display_order")
    .eq("vehicle_id", id)
    .order("display_order", { ascending: true });

  const defaults: VehicleFormData & { id: string } = {
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
    pricing_type: ((vehicle.pricing_type as string) ?? "negotiable") as "fixed" | "negotiable",
    warranty_details: (vehicle.warranty_details as string) ?? "",
    offer_details: (vehicle.offer_details as string) ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <VehicleForm defaultValues={defaults} />
      {["ceo", "sales_manager", "marketing_specialist", "account_manager"].includes(role ?? "") ? (
        <VehicleMediaManager vehicleId={id} media={(media as unknown as StaffMediaRow[]) ?? []} />
      ) : null}
    </div>
  );
}
