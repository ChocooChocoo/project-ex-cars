import { notFound, redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { withSignedTransactionDocumentUrls } from "@/lib/transactions/document-media";

import { SellMeetupCase } from "./_components/sell-meetup-case";

const OVERSEERS = ["ceo", "marketing_specialist"];

// Selling steps 5–6 and 11: the complete case pack for the field team at the seller meet-up.
// The field roles cannot read transactions under RLS (Task 32 kept it that way), so the pack is read
// with the service role, but only for the CEO, the Marketing Specialist, or the assigned team.
export default async function SellMeetupCasePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!role || ![...OVERSEERS, "confidential_informant", "mechanic"].includes(role)) redirect("/unauthorized");

  const {
    data: { user },
  } = await (await createServerSupabase()).auth.getUser();
  if (!user) redirect("/unauthorized");

  const admin = createAdminClient();
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select("*")
    .eq("id", id)
    .eq("case_kind", "acquisition")
    .maybeSingle();
  if (!fieldCase?.transaction_id) notFound();

  const assigned = fieldCase.assigned_confidential_informant === user.id || fieldCase.mechanic_id === user.id;
  if (!OVERSEERS.includes(role) && !assigned) redirect("/unauthorized");

  const [{ data: transaction }, { data: documents }, { data: expenses }] = await Promise.all([
    admin
      .from("transactions")
      .select(
        "id, current_state, profiles(full_name, phone), vehicles(make, model, year, stock_code, mileage), sell_details(*)",
      )
      .eq("id", fieldCase.transaction_id)
      .maybeSingle(),
    admin
      .from("transaction_documents")
      .select("id, document_kind, id_type, verification_state, storage_path")
      .eq("transaction_id", fieldCase.transaction_id)
      .in("document_kind", ["sell_photo", "valid_id", "orcr", "deed_of_sale", "inspection_photo", "expense_proof"]),
    admin
      .from("field_case_expenses")
      .select("id, amount, description, submitted_by, submitted_at, reimbursed_at")
      .eq("field_case_id", id)
      .order("submitted_at", { ascending: true }),
  ]);
  if (!transaction) notFound();

  const signedDocuments = await withSignedTransactionDocumentUrls(admin.storage, documents ?? []);
  const sellDetails = Array.isArray(transaction.sell_details) ? transaction.sell_details[0] : transaction.sell_details;

  return (
    <SellMeetupCase
      fieldCase={fieldCase}
      transaction={transaction as Record<string, unknown>}
      sellDetails={(sellDetails as Record<string, unknown> | null) ?? null}
      documents={signedDocuments}
      expenses={expenses ?? []}
      userRole={role}
      userId={user.id}
    />
  );
}
