import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { SELL_SUBMISSION_VIEWER_ROLES } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";
import { withSignedTransactionDocumentUrls } from "@/lib/transactions/document-media";
import { getConditionItemIds, resolveConditionItemLabels } from "@/lib/transactions/sell-condition-items";

import { SellSubmissionsList, type SellSubmissionListing } from "./_components/sell-submissions-list";

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
 * Lets the field roles look at the photos and condition checklist a customer sent with a car.
 * The list RPC exists because `transactions` has no read policy for them, so the car a
 * submission concerns is otherwise unreachable; it returns nothing but the car and the
 * checklist. Submissions with neither photos nor a checklist have nothing to look at, so they
 * are left out rather than listed as empty rows.
 */
export default async function SellSubmissionsPage() {
  await requireRole(SELL_SUBMISSION_VIEWER_ROLES);
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? "customer";

  const { data: rows } = await supabase.rpc("list_field_sell_submissions");
  const submissions = (rows as SubmissionRow[] | null) ?? [];

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading />
        <SellSubmissionsList submissions={[]} />
      </div>
    );
  }

  const transactionIds = submissions.map((row) => row.transaction_id);

  const { data: documents } = await supabase
    .from("transaction_documents")
    .select("id, transaction_id, document_kind, storage_path")
    .in("transaction_id", transactionIds)
    .eq("document_kind", "sell_photo")
    .order("upload_date", { ascending: true });

  const signedDocuments = await withSignedTransactionDocumentUrls(
    supabase.storage,
    (documents as Record<string, unknown>[] | null) ?? [],
  );

  const photosByTransaction = new Map<string, { id: string; is_image: boolean; signed_url: string | null }[]>();
  for (const document of signedDocuments) {
    const transactionId = String(document.transaction_id);
    const bucket = photosByTransaction.get(transactionId) ?? [];
    bucket.push({ id: String(document.id), is_image: document.is_image, signed_url: document.signed_url });
    photosByTransaction.set(transactionId, bucket);
  }

  const allConditionIds = [...new Set(submissions.flatMap((row) => getConditionItemIds(row.condition_items)))];
  let nodeNames: Record<string, string> = {};
  if (allConditionIds.length > 0) {
    const { data: nodes } = await supabase.from("inspection_checklist_nodes").select("id, name").in("id", allConditionIds);
    nodeNames = Object.fromEntries(
      ((nodes as { id: string; name: string }[] | null) ?? []).map((node) => [node.id, node.name]),
    );
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
