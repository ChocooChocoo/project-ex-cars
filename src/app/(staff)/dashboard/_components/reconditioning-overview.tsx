import { Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface ReconditioningVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  listing_state: string;
  repair_count: number;
  replacement_count: number;
}

// Phase 7: Laravel groups the flagged checklist items per car (most flagged first) for the roles that read inspections.
export function ReconditioningOverview({ vehicles }: { readonly vehicles: ReconditioningVehicle[] }) {
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
            <div className="font-medium text-sm">
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
