import { CustomerHeader } from "@/app/(main)/_components/customer-header";

import { RecommendationPageClient } from "./_components/recommendation-page-client";

export default function RecommendationsPage() {
  return (
    <>
      <CustomerHeader />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Vehicle Recommendations</h1>
          <p className="text-muted-foreground text-sm">
            Enter your budget and preferences to receive personalized vehicle rankings based on five scoring criteria.
          </p>
        </div>
        <RecommendationPageClient />
      </div>
    </>
  );
}
