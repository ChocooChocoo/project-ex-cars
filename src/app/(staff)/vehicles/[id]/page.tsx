import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type VehicleMediaItem, VehicleMediaViewer } from "@/components/vehicle-media-viewer";
import { createServerSupabase } from "@/lib/supabase/server";
import { listingStateLabel, listingStateVariant } from "@/lib/vehicles/labels";

import {
  type PendingProposal,
  PendingProposalAlert,
  VehicleDescriptionCard,
  type VehicleDetail,
  VehicleMetricCards,
  VehiclePurchaseCard,
} from "./_components/vehicle-detail-widgets";
import { type StaffMediaRow, VehicleMediaManager } from "./_components/vehicle-media-manager";

const MEDIA_MANAGER_ROLES = ["marketing_specialist"];

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? null;

  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).single();

  if (!vehicle) notFound();

  const v = vehicle as unknown as VehicleDetail;

  const [{ data: media }, { data: proposal }] = await Promise.all([
    supabase
      .from("vehicle_media")
      .select("id, media_kind, storage_path, display_order")
      .eq("vehicle_id", id)
      .order("display_order", { ascending: true }),
    role === "ceo"
      ? supabase
          .from("vehicle_price_proposals")
          .select("id, proposed_amount, notes, created_at")
          .eq("vehicle_id", id)
          .eq("decision", "pending")
          .order("created_at", { ascending: false })
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
          <Link href="/dashboard/vehicles">
            <ArrowLeft className="size-4" />
            Back to vehicles
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl leading-none tracking-tight">
              {v.make ?? ""} {v.model ?? ""}
            </h1>
            <p className="text-muted-foreground text-sm">
              {v.stock_code ?? "No stock code"}
              {v.vin ? ` · ${v.vin}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{v.year ?? "—"}</Badge>
            <Badge variant={listingStateVariant(v.listing_state)} className="capitalize">
              {listingStateLabel(v.listing_state)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <VehicleMediaViewer media={(media as unknown as VehicleMediaItem[]) ?? []} />
        <VehiclePurchaseCard vehicle={v} />
      </div>

      <PendingProposalAlert proposal={(proposal as unknown as PendingProposal | null) ?? null} />

      <VehicleMetricCards vehicle={v} />

      <VehicleDescriptionCard vehicle={v} />

      {MEDIA_MANAGER_ROLES.includes(role ?? "") ? (
        <VehicleMediaManager vehicleId={id} media={(media as unknown as StaffMediaRow[]) ?? []} />
      ) : null}
    </div>
  );
}
