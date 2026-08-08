import { Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

interface ReconditioningVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  listing_state: string;
  repair_count: number;
  replacement_count: number;
}

export async function ReconditioningOverview() {
  const supabase = await createServerSupabase();

  const { data: rows } = await supabase
    .from("inspection_checklist_results")
    .select("status, vehicle_inspections!inner(vehicle_id, vehicles!inner(id, make, model, year, listing_state))")
    .in("status", ["for_repair", "for_replacement"]);

  const byVehicle = new Map<string, ReconditioningVehicle>();
  for (const row of (rows ?? []) as unknown as {
    status: string;
    vehicle_inspections: {
      vehicle_id: string;
      vehicles: { id: string; make: string; model: string; year: number; listing_state: string };
    };
  }[]) {
    const inspection = row.vehicle_inspections;
    const vehicle = inspection.vehicles;
    if (!vehicle || vehicle.listing_state === "sold" || vehicle.listing_state === "archived") continue;
    const entry = byVehicle.get(vehicle.id) ?? {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      listing_state: vehicle.listing_state,
      repair_count: 0,
      replacement_count: 0,
    };
    if (row.status === "for_repair") entry.repair_count += 1;
    else entry.replacement_count += 1;
    byVehicle.set(vehicle.id, entry);
  }

  const vehicles = [...byVehicle.values()].sort(
    (a, b) => b.repair_count + b.replacement_count - (a.repair_count + a.replacement_count),
  );

  if (vehicles.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="size-4" />
          Vehicles Awaiting Reconditioning
        </CardTitle>
        <CardDescription>Vehicles with inspection items flagged for repair or replacement.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {vehicles.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div className="text-sm font-medium">
              {v.year} {v.make} {v.model}
            </div>
            <div className="flex items-center gap-2">
              {v.repair_count > 0 ? <Badge variant="secondary">{v.repair_count} to repair</Badge> : null}
              {v.replacement_count > 0 ? <Badge variant="destructive">{v.replacement_count} to replace</Badge> : null}
              <a
                href={`/dashboard/inspections?vehicle_id=${v.id}`}
                className="text-muted-foreground text-xs hover:underline"
              >
                View inspection →
              </a>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
