import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { missedPaymentPolicy, paperFinancing, paperSale, type TransactionPaperSource } from "@/lib/papers/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { MISSED_PAYMENT_POLICY_LABEL } from "@/lib/transactions/missed-payment-policy";

import { PaperDocumentView } from "../../_components/paper-document-view";

export default async function MissedPaymentPolicyPage({
  params,
}: {
  readonly params: Promise<{ transactionId: string }>;
}) {
  await requireRole(["ceo", "head_accountant", "sales_manager"]);
  const { transactionId } = await params;
  const { data } = await createAdminClient()
    .from("transactions")
    .select(
      "id, opened_at, completed_at, purchase_details(final_price), profiles(full_name, address), vehicles(make, model, year, exterior_color, plate_number, engine_number, chassis_number, vin, warranty_details), payment_terms(total_amount, down_payment, duration_months, number_of_payments, monthly_payment, first_due_date), installment_accounts(opening_balance)",
    )
    .eq("id", transactionId)
    .maybeSingle();
  if (!data) notFound();

  const source = data as unknown as TransactionPaperSource;
  const paper = missedPaymentPolicy(paperSale(source), paperFinancing(source));

  return (
    <PaperDocumentView
      paper={paper}
      heading={MISSED_PAYMENT_POLICY_LABEL}
      note="Filled in from the financing sale on record. A blank line is a detail GCE has not recorded yet; write it in by hand before signing."
      backHref={`/dashboard/transactions/${transactionId}`}
      backLabel="Transaction"
    />
  );
}
