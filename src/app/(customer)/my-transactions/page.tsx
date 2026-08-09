import { format } from "date-fns";

import { createServerSupabase } from "@/lib/supabase/server";
import { transactionKindLabel } from "@/lib/transactions/labels";
import type { TransactionState } from "@/lib/transactions/state-machine";

import type { TransactionRow } from "./_components/transactions-data";
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

  const rows: TransactionRow[] = (transactions ?? []).map((tx) => {
    const vehicles = tx.vehicles as Record<string, unknown> | undefined;
    const kind = tx.transaction_kind as string;
    const openedAt = tx.opened_at as string;
    const vehicleLabel = vehicles
      ? `${vehicles.make} ${vehicles.model} (${vehicles.year})`
      : transactionKindLabel(kind as never);

    return {
      id: tx.id as string,
      vehicleLabel,
      subLabel: vehicles?.stock_code ? `Stock ${vehicles.stock_code as string}` : transactionKindLabel(kind as never),
      kind,
      status: (tx.current_state ?? "pending") as TransactionState,
      openedAt: format(new Date(openedAt), "dd MMM yyyy"),
      openedTimestamp: new Date(openedAt).getTime(),
    };
  });

  return <TransactionsView transactions={rows} />;
}
