import Link from "next/link";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api/server";

import { ShowroomGrid } from "./_components/showroom-grid";

export default async function ShowroomPage() {
  // Laravel strips GCE-only fields (identifiers, markup) before the rows leave the API.
  const { data } = await apiGet<{ vehicles: Record<string, unknown>[]; favourite_ids: string[] }>(
    "/api/v1/catalogue/vehicles",
  );
  const vehicles = data.vehicles;
  const favouriteIds = data.favourite_ids;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Virtual Showroom</h1>
          <p className="text-muted-foreground text-sm">
            Browse our available vehicles.{" "}
            <Link href="/buying-requirements" className="underline underline-offset-4">
              See what to prepare before you buy
            </Link>
            .
          </p>
        </div>
        <Button asChild>
          <Link href="/recommendations" className="gap-2">
            <Sparkles className="size-4" />
            Find Your Car
          </Link>
        </Button>
      </div>
      <ShowroomGrid vehicles={vehicles} favouriteIds={favouriteIds} />
    </div>
  );
}
