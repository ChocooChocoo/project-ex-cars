import { createServerSupabase } from "@/lib/supabase/server";

import { ShowroomGrid } from "./_components/showroom-grid";

export default async function ShowroomPage() {
  const supabase = await createServerSupabase();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .in("listing_state", ["available", "reserved"])
    .order("posted_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Virtual Showroom</h1>
          <p className="text-muted-foreground text-sm">Browse our available vehicles.</p>
        </div>
      </div>
      <ShowroomGrid vehicles={(vehicles as Record<string, unknown>[]) ?? []} />
    </div>
  );
}
