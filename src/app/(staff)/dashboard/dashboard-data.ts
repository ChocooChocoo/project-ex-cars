import { createAdminClient } from "@/lib/supabase/admin";

import { type DashboardRevenue, type DashboardTransaction, summarizeDashboard } from "./dashboard-summary";

// Finance roles (same list as the "Staff can read financial entries" policy, 00016): only they see money received.
export const REVENUE_ROLES = ["ceo", "head_accountant", "account_manager", "sales_manager"];

const PAGE = 1000;

// Supabase returns at most 1000 rows per request, so read in pages.
async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

// Business-wide totals for the staff dashboard. The page is already limited to staff roles; the service role is
// used so every role sees the same company numbers (row-level rules would give each role a different partial count).
export async function getDashboardData(role: string | null) {
  const admin = createAdminClient();
  const showRevenue = role !== null && REVENUE_ROLES.includes(role);

  const [transactions, revenue, { count: availableVehicles }] = await Promise.all([
    allRows<DashboardTransaction>((from, to) =>
      admin.from("transactions").select("customer_id, opened_at, completed_at, current_state").range(from, to),
    ),
    // Money received = customer payments the Head Accountant verified (or PayMongo confirmed). financial_entries
    // is the manual finance ledger and does not record sale payments.
    showRevenue
      ? allRows<{
          amount: number | string;
          paid_at: string | null;
          settlement_date: string | null;
          created_at: string;
        }>((from, to) =>
          admin
            .from("payment_records")
            .select("amount, paid_at, settlement_date, created_at")
            .not("verified_by", "is", null)
            .range(from, to),
        ).then((rows) =>
          rows.map(
            (row): DashboardRevenue => ({
              amount: row.amount,
              date: row.paid_at ?? row.settlement_date ?? row.created_at,
            }),
          ),
        )
      : Promise.resolve(null),
    admin.from("vehicles").select("id", { count: "exact", head: true }).eq("listing_state", "available"),
  ]);

  return summarizeDashboard({ transactions, revenue, availableVehicles: availableVehicles ?? 0 });
}
