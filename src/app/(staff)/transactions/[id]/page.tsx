import { notFound } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { TRANSACTION_VIEWER_ROLES } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";
import { withSignedTransactionDocumentUrls } from "@/lib/transactions/document-media";

import { StaffTransactionDetail } from "./_components/staff-transaction-detail";

export default async function TransactionDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  // Same guard as the list route: without it RLS filters the row and the caller
  // gets a misleading 404 instead of the /unauthorized screen.
  await requireRole(TRANSACTION_VIEWER_ROLES);
  const { id } = await params;
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? "customer";

  const { data: transaction } = await supabase
    .from("transactions")
    .select(
      "*, vehicles(make, model, year, stock_code, listing_state), profiles(full_name), purchase_details(*), sell_details(*), vehicle_requests(*)",
    )
    .eq("id", id)
    .single();

  if (!transaction) notFound();

  const { data: history } = await supabase
    .from("transaction_status_history")
    .select("*")
    .eq("transaction_id", id)
    .order("changed_at", { ascending: true });

  const { data: documents } = await supabase
    .from("transaction_documents")
    .select("*")
    .eq("transaction_id", id)
    .order("upload_date", { ascending: false });

  const signedDocuments = await withSignedTransactionDocumentUrls(
    supabase.storage,
    (documents as Record<string, unknown>[] | null) ?? [],
  );

  const { data: payments } = await supabase
    .from("payment_records")
    .select("*")
    .eq("transaction_id", id)
    .order("settlement_date", { ascending: false });

  const { data: installmentAccount } = await supabase
    .from("installment_accounts")
    .select("*, installments(*)")
    .eq("purchase_transaction_id", id)
    .maybeSingle();

  const { data: paymentTerms } = await supabase
    .from("payment_terms")
    .select("*")
    .eq("purchase_transaction_id", id)
    .maybeSingle();

  const { data: viewingArrangements } = await supabase
    .from("viewing_arrangements")
    .select("*")
    .eq("purchase_transaction_id", id)
    .order("created_at", { ascending: false });

  // profiles -> private_user_roles is not a PostgREST relationship, so the embed that
  // used to load this list answered PGRST200 and left the repossession informant
  // picker empty. Read the guarded worker directory instead.
  const { data: workerDirectory } = await supabase.rpc("list_field_case_workers");
  const informants = (
    (workerDirectory as { account_id: string; role: string; full_name: string | null }[] | null) ?? []
  )
    .filter((worker) => worker.role === "confidential_informant")
    .map((worker) => ({ id: worker.account_id, full_name: worker.full_name }));

  // Task 32: resolve sell condition_items ids to display names for staff.
  // sell_details is a UNIQUE-per-transaction row; the relation may still come
  // back as an array, so normalize first.
  const sellDetailsRow = (transaction as Record<string, unknown> | null)?.sell_details as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;
  const sellDetailsSingle = Array.isArray(sellDetailsRow) ? (sellDetailsRow[0] ?? null) : sellDetailsRow;
  const rawConditionItems = sellDetailsSingle?.condition_items;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const conditionIds = Array.isArray(rawConditionItems)
    ? rawConditionItems.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id))
    : [];
  let checklistNameMap: Record<string, string> = {};
  if (conditionIds.length > 0) {
    const { data: nodes } = await supabase.from("inspection_checklist_nodes").select("id, name").in("id", conditionIds);
    checklistNameMap = Object.fromEntries(
      ((nodes as { id: string; name: string }[] | null) ?? []).map((node) => [node.id, node.name]),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StaffTransactionDetail
        transaction={transaction as Record<string, unknown>}
        history={(history as Record<string, unknown>[]) ?? []}
        documents={signedDocuments}
        payments={(payments as Record<string, unknown>[]) ?? []}
        installmentAccount={installmentAccount as Record<string, unknown> | null}
        paymentTerms={paymentTerms as Record<string, unknown> | null}
        viewingArrangements={(viewingArrangements as Record<string, unknown>[]) ?? []}
        userRole={role}
        informants={informants}
        checklistNameMap={checklistNameMap}
      />
    </div>
  );
}
