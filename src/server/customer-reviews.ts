import { createAdminClient } from "@/lib/supabase/admin";

export async function getPublishedReviews() {
  const admin = createAdminClient();
  const [{ data: reviews, error }, { data: ratings, error: ratingsError }] = await Promise.all([
    admin
      .from("customer_reviews")
      .select("id, rating, body, created_at, profiles(full_name), vehicles(make, model, year)")
      .eq("state", "published")
      .order("created_at", { ascending: false })
      .limit(6),
    admin.from("customer_reviews").select("rating").eq("state", "published"),
  ]);
  const count = ratings?.length ?? 0;
  return {
    reviews: error ? [] : (reviews ?? []),
    average: !ratingsError && count ? (ratings ?? []).reduce((sum, row) => sum + row.rating, 0) / count : null,
    count,
  };
}
