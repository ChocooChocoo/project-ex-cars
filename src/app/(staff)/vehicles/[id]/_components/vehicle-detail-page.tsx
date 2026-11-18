"use client";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { useSession } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type VehicleMediaItem, VehicleMediaViewer } from "@/components/vehicle-media-viewer";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import { useRouteParam } from "@/lib/routing/use-route-param";
import { listingStateLabel, listingStateVariant } from "@/lib/vehicles/labels";

import { ReconditioningPanel } from "./reconditioning-panel";
import {
  type PendingProposal,
  PendingProposalAlert,
  RevisionRequestedAlert,
  VehicleDescriptionCard,
  type VehicleDetail,
  VehicleMetricCards,
  VehiclePurchaseCard,
} from "./vehicle-detail-widgets";
import { type StaffMediaRow, VehicleMediaManager } from "./vehicle-media-manager";

const MEDIA_MANAGER_ROLES = ["marketing_specialist"];

export function VehicleDetailPage() {
  const id = useRouteParam("vehicles");
  const role = useSession().role;

  // Laravel shapes this page's data by role: the CEO's pending proposal, the Marketing Specialist's latest
  // revision request, and the latest reconditioning job with 1-hour signed links to its private photos.
  const page = usePageData(`staff-vehicle/${id}`, () =>
    browserApi<{
      vehicle: Record<string, unknown>;
      media: Record<string, unknown>[];
      proposal: Record<string, unknown> | null;
      reconditioning: Record<string, unknown> | null;
      revision: Record<string, unknown> | null;
    }>("GET", `/api/v1/staff/vehicles/${encodeURIComponent(id)}`),
  );
  if (page.error instanceof ApiError && page.error.status === 404) notFound();
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;
  const data = page.data;
  const { media, proposal, revision } = data;
  const v = data.vehicle as unknown as VehicleDetail;
  const reconditioningJob = data.reconditioning;

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
            <p className="text-muted-foreground text-sm">{v.stock_code ?? "No stock code"}</p>
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
