"use client";

import { notFound } from "next/navigation";

import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { type VehicleMediaItem, VehicleMediaViewer } from "@/components/vehicle-media-viewer";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import { useRouteParam } from "@/lib/routing/use-route-param";

import { InquiryButtons } from "./inquiry-buttons";

export function VehicleDetailPage() {
  const id = useRouteParam("showroom");
  // Laravel answers 404 unless the car is available, and strips GCE-only fields.
  const page = usePageData(`showroom/${id}`, () =>
    browserApi<{ vehicle: Record<string, unknown>; media: VehicleMediaItem[] }>(
      "GET",
      `/api/v1/catalogue/vehicles/${encodeURIComponent(id)}`,
    ),
  );
  if (page.error instanceof ApiError && page.error.status === 404) notFound();
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;
  const { vehicle, media } = page.data;

  const v = vehicle as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <VehicleMediaViewer media={media} />
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
            </div>
            {/* Notes line 179: a car that went through reconditioning says so. */}
            {v.condition === "Reconditioned" ? (
              <Badge variant="secondary" className="w-fit">
                Reconditioned
              </Badge>
            ) : null}
            {(v.offer_details as string) ? (
              <Badge variant="outline" className="w-fit text-green-700">
                {v.offer_details as string}
              </Badge>
            ) : null}
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
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
                <span className="text-muted-foreground">Interior</span>
                <p>{(v.interior_color as string) ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Best for</span>
                <p className="capitalize">{(v.purpose as string) ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stock Code</span>
                <p>{(v.stock_code as string) ?? "—"}</p>
              </div>
            </div>
            {/* BC-11: what the Marketing Specialist listed inside, under the Interior color above. */}
            {(v.interior_features as string) ? (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground text-sm">Interior features</span>
                  <p className="whitespace-pre-wrap text-sm">{v.interior_features as string}</p>
                </div>
              </>
            ) : null}
            <Separator />
            <InquiryButtons vehicleId={id} />
          </CardContent>
        </Card>
      </div>
      {(v.description as string) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{v.description as string}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
