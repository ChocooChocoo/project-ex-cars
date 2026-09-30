import { notFound, redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { withSignedTransactionDocumentUrls } from "@/lib/transactions/document-media";

import { DeliveryCase } from "./_components/delivery-case";
import { SellMeetupCase } from "./_components/sell-meetup-case";

// Who oversees each kind of case besides the assigned team.
const OVERSEERS: Record<string, string[]> = {
  acquisition: ["ceo", "marketing_specialist"],
  delivery: ["ceo", "sales_manager"],
};
const FIELD_TEAM = ["confidential_informant", "mechanic", "head_security"];

// Selling steps 5–6 and 11, Delivery steps 7–7b: the case pack for the field team.
// The field roles cannot read transactions under RLS (Task 32 kept it that way), so the pack is read
// with the service role, but only for the case's overseers or its assigned team.
export default async function FieldCasePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const {
    data: { user },
  } = await (await createServerSupabase()).auth.getUser();
  if (!user) redirect("/unauthorized");

  const admin = createAdminClient();
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select("*")
    .eq("id", id)
    .in("case_kind", ["acquisition", "delivery"])
    .maybeSingle();
  if (!fieldCase?.transaction_id) notFound();

  const assigned = [
    fieldCase.assigned_confidential_informant,
    fieldCase.mechanic_id,
    fieldCase.head_security_id,
  ].includes(user.id);
  const overseer = OVERSEERS[fieldCase.case_kind]?.includes(role) ?? false;
  if (!overseer && !(assigned && FIELD_TEAM.includes(role))) redirect("/unauthorized");

  if (fieldCase.case_kind === "delivery") {
    const { data: transaction } = await admin
      .from("transactions")
      .select(
        "id, current_state, profiles(full_name, phone), vehicles(make, model, year, stock_code), purchase_details(final_price, delivery_fee, downpayment_amount)",
      )
      .eq("id", fieldCase.transaction_id)
      .maybeSingle();
    if (!transaction) notFound();
    return (
      <DeliveryCase
        fieldCase={fieldCase}
        transaction={transaction as Record<string, unknown>}
        userRole={role}
        userId={user.id}
      />
    );
  }

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
