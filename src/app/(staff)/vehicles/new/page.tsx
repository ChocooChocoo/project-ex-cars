import { getFinancingMarkupPct } from "@/lib/settings/financing";

import { VehicleForm } from "../_components/vehicle-form";

export default async function NewVehiclePage() {
  // T11: the form shows GCE's global markup as the fallback for the per-car field.
  const defaultMarkupPct = await getFinancingMarkupPct();

  return <VehicleForm defaultMarkupPct={defaultMarkupPct} />;
}
