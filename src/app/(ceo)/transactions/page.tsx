import { getCurrentRole } from "@/app/(auth)/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { TransactionsTable } from "./_components/transactions-table";

export default async function TransactionsPage() {
  const supabase = await createServerSupabase();
  const role = (await getCurrentRole()) ?? "customer";

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, vehicles(make, model, year), purchase_details(*), sell_details(*), vehicle_requests(*)")
    .order("updated_at", { ascending: false });

  // KPI counts
  const all = (transactions as Record<string, unknown>[]) ?? [];
  const pending = all.filter((t) => t.current_state === "pending").length;
  const underReview = all.filter((t) => t.current_state === "under_review").length;
  const completed = all.filter((t) => t.current_state === "completed").length;
  const buy = all.filter((t) => t.transaction_kind === "buy").length;
  const sell = all.filter((t) => t.transaction_kind === "sell").length;
  const request = all.filter((t) => t.transaction_kind === "request_a_car").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">Manage buy, sell, and request-a-car transactions.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <KpiCard label="Pending" value={pending} />
        <KpiCard label="Under Review" value={underReview} />
        <KpiCard label="Completed" value={completed} />
        <KpiCard label="Buy" value={buy} />
        <KpiCard label="Sell" value={sell} />
        <KpiCard label="Requests" value={request} />
      </div>
      <TransactionsTable transactions={all} userRole={role} />
    </div>
  );
}

function KpiCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-bold text-2xl">{value}</p>
    </div>
  );
}
