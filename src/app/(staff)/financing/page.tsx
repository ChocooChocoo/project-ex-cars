import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";

import { type CashSale, FinancingMonitor } from "./_components/financing-monitor";

export default async function FinancingPage() {
  await requireRole(["ceo", "head_accountant"]);
  const supabase = await createServerSupabase();
  const [{ data, error }, { data: workers }, { data: cases }, { data: sold }] = await Promise.all([
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
    // T10: cars sold outright count as inventory too.
    supabase
      .from("transactions")
      .select(
        "id, completed_at, profiles(full_name), vehicles(make, model, year), purchase_details!inner(payment_method, final_price)",
      )
      .eq("transaction_kind", "buy")
      .eq("current_state", "completed")
      .in("purchase_details.payment_method", ["cash", "bank_transfer"])
      .order("completed_at", { ascending: false }),
  ]);
  return (
    <FinancingMonitor
      accounts={data ?? []}
      cashSales={
        (sold ?? []).map((row) => ({
          ...row,
          purchase_details: Array.isArray(row.purchase_details)
            ? (row.purchase_details[0] ?? null)
            : row.purchase_details,
        })) as unknown as CashSale[]
      }
      workers={workers ?? []}
      cases={cases ?? []}
      canRequest={(await getCurrentRole()) === "head_accountant"}
      error={error?.message}
    />
  );
}
