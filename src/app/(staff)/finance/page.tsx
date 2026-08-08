import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { type DisbursementRow, FinanceClient, type FinancialEntryRow } from "./_components/finance-client";

const FINANCE_ROLES = ["ceo", "head_accountant", "account_manager", "confidential_informant"];

export default async function FinancePage() {
  const role = await getCurrentRole();
  if (!role || !FINANCE_ROLES.includes(role)) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isInformant = role === "confidential_informant";

  const entriesQuery = supabase
    .from("financial_entries")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(100);
  let disbursementsQuery = supabase
    .from("disbursement_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (isInformant && user) {
    disbursementsQuery = disbursementsQuery.eq("requested_by", user.id);
  }

  const [{ data: entries }, { data: disbursements }, { data: purchaseTransactions }] = await Promise.all([
    entriesQuery,
    disbursementsQuery,
    supabase
      .from("transactions")
      .select("id, customer_id, transaction_kind")
      .eq("transaction_kind", "buy")
      .not("current_state", "in", "('cancelled','rejected')")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <FinanceClient
      entries={(entries as unknown as FinancialEntryRow[]) ?? []}
      disbursements={(disbursements as unknown as DisbursementRow[]) ?? []}
      purchaseTransactions={
        (purchaseTransactions ?? []) as { id: string; customer_id: string; transaction_kind: string }[]
      }
      canRecord={!isInformant && ["ceo", "head_accountant", "account_manager"].includes(role)}
      canVerify={!isInformant && ["ceo", "head_accountant"].includes(role)}
      canRequest={["ceo", "account_manager", "confidential_informant"].includes(role)}
      canAdvance={!isInformant && ["ceo", "head_accountant"].includes(role)}
      canRequestPurchaseFunds={!isInformant && ["ceo", "account_manager"].includes(role)}
      isInformant={isInformant}
    />
  );
}
