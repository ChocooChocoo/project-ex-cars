import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).single();

  if (!vehicle) notFound();

  const v = vehicle as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted lg:col-span-2">
          <p className="text-muted-foreground">Vehicle images coming soon</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {(v.make as string) ?? ""} {(v.model as string) ?? ""}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{v.year as number}</Badge>
              <Badge variant={v.listing_state === "available" ? "default" : "secondary"} className="capitalize">
                {(v.listing_state as string)?.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <span className="font-bold text-3xl">₱{((v.current_price as number) ?? 0).toLocaleString()}</span>
              <Badge variant="secondary" className="ml-2 capitalize">
                {(v.pricing_type as string) ?? "negotiable"}
              </Badge>
            </div>
            {v.offer_details && (
              <Badge variant="outline" className="w-fit text-green-700">
                {v.offer_details as string}
              </Badge>
            )}
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Condition</span>
                <p className="capitalize">{(v.condition as string) ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Mileage</span>
                <p>{v.mileage ? `${(v.mileage as number).toLocaleString()} km` : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Transmission</span>
                <p>{(v.transmission as string) ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fuel Type</span>
                <p>{(v.fuel_type as string) ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Body Type</span>
                <p>{(v.body_type as string) ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Engine</span>
                <p>{(v.engine as string) ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Color</span>
                <p>{(v.exterior_color as string) ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stock Code</span>
                <p>{(v.stock_code as string) ?? "—"}</p>
              </div>
            </div>
            {v.warranty_details && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground text-sm">Warranty</span>
                  <p className="text-sm">{v.warranty_details as string}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      {v.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{v.description as string}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
