import Link from "next/link";

import { Sparkles } from "lucide-react";

import { getCurrentRole } from "@/app/(main)/auth/actions";
import { ShowroomGrid } from "@/app/(main)/showroom/_components/showroom-grid";
import { Button } from "@/components/ui/button";
import { rolePath } from "@/lib/routing/paths";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function DashboardShowroomPage() {
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? "ceo";

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
        <Button asChild>
          <Link href={rolePath(role, "/recommendations")} className="gap-2">
            <Sparkles className="size-4" />
            Find Your Car
          </Link>
        </Button>
      </div>
      <ShowroomGrid vehicles={(vehicles as Record<string, unknown>[]) ?? []} />
    </div>
  );
}
