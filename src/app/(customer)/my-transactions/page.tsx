import Link from "next/link";

import { PlusCircle, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";

import { TransactionsList } from "./_components/transactions-list";

export default async function MyTransactionsPage() {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, vehicles(make, model, year)")
    .eq("customer_id", user.user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">My Transactions</h1>
          <p className="text-muted-foreground text-sm">Track your purchases, sales, and vehicle requests.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/request-a-car">
              <PlusCircle className="mr-1.5 size-4" />
              Request a Car
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sell-vehicle">
              <ReceiptText className="mr-1.5 size-4" />
              Sell Your Vehicle
            </Link>
          </Button>
        </div>
      </div>
      <TransactionsList transactions={(transactions as Record<string, unknown>[]) ?? []} baseUrl="/my-transactions" />
    </div>
  );
}
