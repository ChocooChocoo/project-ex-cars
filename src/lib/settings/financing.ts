import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FINANCING_MARKUP_PCT } from "@/lib/transactions/buy-flow";

// T06: GCE's financing profit, stored in `app_settings`. Falls back to the original 10% if the row is
// missing or unreadable, so a settings problem never blocks a sale.
export async function getFinancingMarkupPct(): Promise<number> {
  const { data } = await createAdminClient()
    .from("app_settings")
    .select("value")
    .eq("key", "financing_markup_pct")
    .maybeSingle();
  const pct = Number(data?.value);
  return Number.isFinite(pct) && pct >= 0 ? pct : DEFAULT_FINANCING_MARKUP_PCT;
}
