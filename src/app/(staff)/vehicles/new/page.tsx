"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import { VehicleForm } from "../_components/vehicle-form";

export default function NewVehiclePage() {
  // T11: the form shows GCE's global markup as the fallback for the per-car field (read with the staff list).
  const page = usePageData("new-vehicle", () =>
    browserApi<{ default_markup_pct: number }>("GET", "/api/v1/staff/vehicles"),
  );
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;

  return <VehicleForm defaultMarkupPct={page.data.default_markup_pct} />;
}
