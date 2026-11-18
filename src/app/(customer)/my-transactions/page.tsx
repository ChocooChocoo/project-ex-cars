"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

import { buildTransactionRows, type TransactionRow } from "./_components/transactions-data";
import { TransactionsView } from "./_components/transactions-view";

type ReviewRow = {
  id: string;
  rating: number;
  body: string;
  created_at: string;
  vehicles: { make: string; model: string; year: number } | null;
};

export default function MyTransactionsPage() {
  // Phase 5: Laravel returns only this customer's transactions and reviews.
  const page = usePageData("my-transactions", () =>
    browserApi<{ transactions: Record<string, unknown>[]; reviews: ReviewRow[] }>("GET", "/api/v1/my-transactions"),
  );
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;

  const rows: TransactionRow[] = buildTransactionRows(page.data.transactions);
  const reviews = page.data.reviews;
  const reviewsError = !Array.isArray(reviews);

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
