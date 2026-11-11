import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type VehicleMediaItem, VehicleMediaViewer } from "@/components/vehicle-media-viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { listingStateLabel, listingStateVariant } from "@/lib/vehicles/labels";

import { ReconditioningPanel } from "./_components/reconditioning-panel";
import {
  type PendingProposal,
  PendingProposalAlert,
  RevisionRequestedAlert,
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

  const [{ data: media }, { data: proposal }, { data: reconditioning }, { data: revision }] = await Promise.all([
    supabase
      .from("vehicle_media")
      .select("id, media_kind, storage_path, display_order")
      .eq("vehicle_id", id)
      .order("display_order", { ascending: true }),
    role === "ceo"
      ? supabase
          .from("vehicle_price_proposals")
          .select("id, proposed_amount, notes, created_at, proposal_kind")
          .eq("vehicle_id", id)
          .eq("decision", "pending")
          .order("created_at", { ascending: false })
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // §6 steps 27–38: the latest reconditioning job of a repossessed car (RLS limits who sees it).
    supabase
      .from("reconditioning_jobs")
      .select(
        "*, disbursement_requests(status, amount_cents), reconditioning_parts(*), reconditioning_fund_requests(*, reconditioning_fund_receipts(*), disbursement_requests(status))",
      )
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // T06: the CEO's latest Request Revision, while the car still waits for a new price.
    role === "marketing_specialist" && (v.listing_state === "draft" || v.listing_state === "repairing")
      ? supabase
          .from("vehicle_price_proposals")
          .select("decision, decision_notes, decision_date")
          .eq("vehicle_id", id)
          .neq("proposal_kind", "purchase_ceiling")
          .neq("proposal_kind", "revised_ceiling")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Receipts live in a private bucket; the panel gets short-lived signed links.
  const reconditioningJob = reconditioning as
    | (Record<string, unknown> & {
        reconditioning_fund_requests?: Array<
          Record<string, unknown> & {
            reconditioning_fund_receipts?: Array<Record<string, unknown>>;
          }
        >;
      })
    | null;
  // T10: each reconditioning part carries a photo in the same private bucket.
  const parts = (reconditioningJob as { reconditioning_parts?: Array<Record<string, unknown>> } | null)
    ?.reconditioning_parts;
  if (parts?.length) {
    const admin = createAdminClient();
    for (const part of parts) {
      if (!part.photo_path) continue;
      const { data } = await admin.storage
        .from("reconditioning-receipts")
        .createSignedUrl(String(part.photo_path), 3600);
      part.photo_url = data?.signedUrl ?? null;
    }
  }
  if (reconditioningJob?.reconditioning_fund_requests?.length) {
    const admin = createAdminClient();
    for (const request of reconditioningJob.reconditioning_fund_requests) {
      for (const receipt of request.reconditioning_fund_receipts ?? []) {
        const path = String(receipt.storage_path ?? "");
        if (!path) continue;
        const { data } = await admin.storage.from("reconditioning-receipts").createSignedUrl(path, 3600);
        receipt.signed_url = data?.signedUrl ?? null;
      }
    }
  }

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

      <RevisionRequestedAlert
        revision={
          revision?.decision === "rejected"
            ? (revision as { decision_notes: string | null; decision_date: string | null })
            : null
        }
      />

      <VehicleMetricCards vehicle={v} />

      <VehicleDescriptionCard vehicle={v} />

      {reconditioningJob ? <ReconditioningPanel job={reconditioningJob} userRole={role ?? ""} /> : null}

      {MEDIA_MANAGER_ROLES.includes(role ?? "") ? (
        <VehicleMediaManager vehicleId={id} media={(media as unknown as StaffMediaRow[]) ?? []} />
      ) : null}
    </div>
  );
}
