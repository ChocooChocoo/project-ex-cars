import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { type FieldExpenseRow, FieldExpensesCard } from "./_components/field-expenses-card";
import { type DisbursementRow, FinanceClient, type FinancialEntryRow } from "./_components/finance-client";
import { type SaleRecordRow, SaleRecordsCard } from "./_components/sale-records-card";

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

  const [
    { data: entries },
    { data: disbursements },
    { data: purchaseTransactions },
    { data: clearedSells },
    { data: fieldExpenses },
    { data: saleRecords },
  ] = await Promise.all([
    entriesQuery,
    disbursementsQuery,
    supabase
      .from("transactions")
      .select("id, customer_id, transaction_kind")
      .eq("transaction_kind", "buy")
      .not("current_state", "in", "('cancelled','rejected')")
      .order("created_at", { ascending: false })
      .limit(50),
    // Selling step 10: seller cars cleared by the inspection or the seller's answer, awaiting payment.
    supabase
      .from("transactions")
      .select("id, customer_id, transaction_kind, sell_details!inner(cleared_for_payment_at)")
      .eq("transaction_kind", "sell")
      .eq("current_state", "approved")
      .not("sell_details.cleared_for_payment_at", "is", null),
    // Selling step 13: field expenses; RLS limits this to the CEO, Head Accountant and submitters.
    supabase
      .from("field_case_expenses")
      .select(
        "id, amount, description, submitted_at, reimbursed_at, field_cases(transaction_id, vehicles(make, model, year, listing_state))",
      )
      .is("reimbursed_at", null)
      .order("submitted_at", { ascending: true }),
    // §2 step 7: completed sales, for the Head Accountant's records.
    supabase
      .from("transactions")
      .select(
        "id, completed_at, vehicles(make, model, year, stock_code), profiles(full_name), purchase_details(final_price, payment_method), payment_records(amount)",
      )
      .eq("transaction_kind", "buy")
      .eq("current_state", "completed")
      .order("completed_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <FinanceClient
        entries={(entries as unknown as FinancialEntryRow[]) ?? []}
        disbursements={(disbursements as unknown as DisbursementRow[]) ?? []}
        purchaseTransactions={
          [...(clearedSells ?? []), ...(purchaseTransactions ?? [])] as {
            id: string;
            customer_id: string;
            transaction_kind: string;
          }[]
        }
        canRecord={!isInformant && ["ceo", "head_accountant", "account_manager"].includes(role)}
        canVerify={!isInformant && ["ceo", "head_accountant"].includes(role)}
        canRequest={["ceo", "account_manager", "confidential_informant"].includes(role)}
        canAdvance={!isInformant && ["ceo", "head_accountant"].includes(role)}
        canRequestPurchaseFunds={!isInformant && ["ceo", "account_manager"].includes(role)}
        isInformant={isInformant}
      />
      {["ceo", "head_accountant"].includes(role) ? (
        <SaleRecordsCard sales={(saleRecords as unknown as SaleRecordRow[]) ?? []} />
      ) : null}
      {["ceo", "head_accountant"].includes(role) ? (
        <FieldExpensesCard
          expenses={(fieldExpenses as unknown as FieldExpenseRow[]) ?? []}
          canReimburse={role === "head_accountant"}
        />
      ) : null}
    </div>
  );
}
