import { notFound } from "next/navigation";

import { getProfileAutoFill } from "@/lib/autofill";
import { createServerSupabase } from "@/lib/supabase/server";

import { TransactionDetail } from "../_components/transaction-detail";

export default async function MyTransactionDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: transaction } = await supabase
    .from("transactions")
    .select(
      "*, vehicles(make, model, year, stock_code, current_price), purchase_details(*), sell_details(*), vehicle_requests(*)",
    )
    .eq("id", id)
    .eq("customer_id", user.user.id)
    .single();

  if (!transaction) notFound();

  const { data: history } = await supabase
    .from("transaction_status_history")
    .select("*")
    .eq("transaction_id", id)
    .order("changed_at", { ascending: true });

  const { data: documents } = await supabase
    .from("transaction_documents")
    .select("*")
    .eq("transaction_id", id)
    .order("upload_date", { ascending: false });

  const { data: payments } = await supabase
    .from("payment_records")
    .select("*")
    .eq("transaction_id", id)
    .order("settlement_date", { ascending: false });

  const { data: installmentAccount } = await supabase
    .from("installment_accounts")
    .select("*, installments(*)")
    .eq("purchase_transaction_id", id)
    .maybeSingle();

  const { data: paymentTerms } = await supabase
    .from("payment_terms")
    .select("*")
    .eq("purchase_transaction_id", id)
    .maybeSingle();

  const { data: viewingArrangements } = await supabase
    .from("viewing_arrangements")
    .select("*")
    .eq("purchase_transaction_id", id)
    .order("created_at", { ascending: false });

  const autofill = await getProfileAutoFill();

  return (
    <div className="flex flex-col gap-6">
      <TransactionDetail
        transaction={transaction as Record<string, unknown>}
        history={(history as Record<string, unknown>[]) ?? []}
        documents={(documents as Record<string, unknown>[]) ?? []}
        payments={(payments as Record<string, unknown>[]) ?? []}
        installmentAccount={installmentAccount as Record<string, unknown> | null}
        paymentTerms={paymentTerms as Record<string, unknown> | null}
        viewingArrangements={(viewingArrangements as Record<string, unknown>[]) ?? []}
        autofill={autofill}
      />
    </div>
  );
}
