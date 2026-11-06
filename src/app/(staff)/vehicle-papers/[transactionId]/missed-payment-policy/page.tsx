import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { missedPaymentPolicy } from "@/lib/papers/templates";
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
  const { data } = await createAdminClient().from("transactions").select("id").eq("id", transactionId).maybeSingle();
  if (!data) notFound();

  return (
    <PaperDocumentView
      paper={missedPaymentPolicy()}
      heading={MISSED_PAYMENT_POLICY_LABEL}
      note="Print this policy for the client at delivery."
      backHref={`/dashboard/transactions/${transactionId}`}
      backLabel="Transaction"
    />
  );
}
