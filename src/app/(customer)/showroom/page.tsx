import Link from "next/link";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";

import { ShowroomGrid } from "./_components/showroom-grid";

export default async function ShowroomPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .in("listing_state", ["available", "reserved"])
    .order("posted_at", { ascending: false });

  let favouriteIds: string[] = [];
  if (user) {
    const { data: favs } = await supabase.from("favourites").select("vehicle_id").eq("customer_id", user.id);
    favouriteIds = (favs ?? []).map((f) => f.vehicle_id as string);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Virtual Showroom</h1>
          <p className="text-muted-foreground text-sm">Browse our available vehicles.</p>
        </div>
        <Button asChild>
          <Link href="/recommendations" className="gap-2">
            <Sparkles className="size-4" />
            Find Your Car
          </Link>
        </Button>
      </div>
      <ShowroomGrid vehicles={(vehicles as Record<string, unknown>[]) ?? []} favouriteIds={favouriteIds} />
    </div>
  );
}
