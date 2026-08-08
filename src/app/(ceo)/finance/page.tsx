import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { type DisbursementRow, FinanceClient, type FinancialEntryRow } from "./_components/finance-client";

const FINANCE_ROLES = ["ceo", "head_accountant", "account_manager"];

export default async function FinancePage() {
  const role = await getCurrentRole();
  if (!role || !FINANCE_ROLES.includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();

  const [{ data: entries }, { data: disbursements }] = await Promise.all([
    supabase.from("financial_entries").select("*").order("recorded_at", { ascending: false }).limit(100),
    supabase.from("disbursement_requests").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <FinanceClient
      entries={(entries as unknown as FinancialEntryRow[]) ?? []}
      disbursements={(disbursements as unknown as DisbursementRow[]) ?? []}
      canRecord={["ceo", "head_accountant", "account_manager"].includes(role)}
      canVerify={["ceo", "head_accountant"].includes(role)}
      canRequest={["ceo", "account_manager", "confidential_informant"].includes(role)}
      canAdvance={["ceo", "head_accountant"].includes(role)}
    />
  );
}
