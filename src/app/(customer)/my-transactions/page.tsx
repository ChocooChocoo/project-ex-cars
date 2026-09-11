import { createServerSupabase } from "@/lib/supabase/server";

import { buildTransactionRows, type TransactionRow } from "./_components/transactions-data";
import { TransactionsView } from "./_components/transactions-view";

export default async function MyTransactionsPage() {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, vehicles(make, model, year, stock_code)")
    .eq("customer_id", user.user.id)
    .order("updated_at", { ascending: false });

  const rows: TransactionRow[] = buildTransactionRows((transactions ?? []) as Record<string, unknown>[]);

  return <TransactionsView transactions={rows} />;
}
