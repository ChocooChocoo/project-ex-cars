"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { SELL_SUBMISSION_VIEWER_ROLES } from "@/lib/auth/roles";
import type { SignedTransactionDocument } from "@/lib/transactions/document-media";
import { resolveConditionItemLabels } from "@/lib/transactions/sell-condition-items";

import { type SellSubmissionListing, SellSubmissionsList } from "./_components/sell-submissions-list";

type SubmissionRow = {
  transaction_id: string;
  current_state: string | null;
  opened_at: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_stock_code: string | null;
  condition_items: unknown;
};

/**
 * Lets the field roles look at the photos and condition checklist a customer sent with a car. Laravel returns
 * nothing but the car, the checklist and signed photo links (was the list_field_sell_submissions RPC).
 * Submissions with neither photos nor a checklist have nothing to look at, so they are left out.
 */
export default function SellSubmissionsPage() {
  const allowed = useRequireRole(SELL_SUBMISSION_VIEWER_ROLES);
  const page = usePageData(allowed ? "sell-submissions" : "sell-submissions:denied", () =>
    allowed
      ? browserApi<{
          role: string | null;
          submissions: SubmissionRow[];
          photos: SignedTransactionDocument[];
          nodeNames: Record<string, string>;
        }>("GET", "/api/v1/staff/sell-submissions")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const role = page.data.role ?? "customer";
  const submissions = page.data.submissions;
  const nodeNames = page.data.nodeNames;

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading />
        <SellSubmissionsList submissions={[]} />
      </div>
    );
  }

  const photosByTransaction = new Map<string, { id: string; is_image: boolean; signed_url: string | null }[]>();
  for (const document of page.data.photos) {
    const transactionId = String(document.transaction_id);
    const bucket = photosByTransaction.get(transactionId) ?? [];
    bucket.push({ id: String(document.id), is_image: document.is_image, signed_url: document.signed_url });
    photosByTransaction.set(transactionId, bucket);
  }

  const listings: SellSubmissionListing[] = submissions
    .map((row) => {
      const name = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ");
      const year = row.vehicle_year ? `(${row.vehicle_year})` : "";
      const vehicleName = [name, year].filter(Boolean).join(" ").trim();

      return {
        transactionId: String(row.transaction_id),
        state: row.current_state ?? "pending",
        openedAt: row.opened_at,
        vehicleLabel: vehicleName || null,
        conditionItems: resolveConditionItemLabels(row.condition_items, nodeNames),
        photos: photosByTransaction.get(String(row.transaction_id)) ?? [],
      };
    })
    // A submission with nothing attached is not something the driver can act on.
    .filter((listing) => listing.photos.length > 0 || listing.conditionItems.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading />
      <SellSubmissionsList submissions={listings} />
      <p className="text-muted-foreground text-xs">
        Signed in as {role.replace(/_/g, " ")}. Photos and checklists are read-only.
      </p>
    </div>
  );
}

function PageHeading() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl leading-none tracking-tight">Sell submissions</h1>
      <p className="text-muted-foreground text-sm">
        Cars customers have offered, with the photos and issues they reported. Read-only.
      </p>
    </div>
  );
}
