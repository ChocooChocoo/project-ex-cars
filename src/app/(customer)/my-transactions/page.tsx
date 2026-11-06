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
  const { data: reviews, error: reviewsError } = await supabase
    .from("customer_reviews")
    .select("id, rating, body, created_at, vehicles(make, model, year)")
    .eq("customer_id", user.user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <TransactionsView transactions={rows} />
      <section aria-labelledby="your-reviews" className="rounded-xl border bg-card p-4">
        <h2 id="your-reviews" className="font-medium">
          Your reviews
        </h2>
        {reviewsError ? (
          <p role="alert">Could not load your reviews. Refresh to try again.</p>
        ) : !reviews?.length ? (
          <p className="mt-2 text-muted-foreground text-sm">Complete a transaction to review GCE.</p>
        ) : (
          <ul className="divide-y">
            {reviews.map((review) => {
              const vehicle = Array.isArray(review.vehicles) ? review.vehicles[0] : review.vehicles;
              return (
                <li key={review.id} className="space-y-2 py-4">
                  <p className="text-sm">
                    {review.rating}/5 · {new Date(review.created_at).toLocaleDateString("en-PH")} ·{" "}
                    {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "GCE transaction"}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">{review.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
