import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";

import { FinancingMonitor } from "./_components/financing-monitor";

export default async function FinancingPage() {
  await requireRole(["ceo", "head_accountant"]);
  const supabase = await createServerSupabase();
  const [{ data, error }, { data: workers }, { data: cases }] = await Promise.all([
    supabase
      .from("installment_accounts")
      .select(
        "*, transactions!purchase_transaction_id(id, profiles(full_name), vehicles(make, model, year)), installments(*)",
      )
      .eq("state", "active"),
    supabase.rpc("list_field_case_workers"),
    supabase
      .from("field_cases")
      .select("id, transaction_id")
      .eq("case_kind", "recovery")
      .in("state", ["assigned", "accepted", "in_progress"]),
  ]);
  return (
    <FinancingMonitor
      accounts={data ?? []}
      workers={workers ?? []}
      cases={cases ?? []}
      canRequest={(await getCurrentRole()) === "head_accountant"}
      error={error?.message}
    />
  );
}
