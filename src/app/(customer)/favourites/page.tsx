"use client";

import { ShowroomGrid } from "@/app/(customer)/showroom/_components/showroom-grid";
import { getFavourites } from "@/app/(staff)/vehicles/catalogue-actions";
import { PageSkeleton } from "@/components/page-skeleton";
import { usePageData } from "@/lib/api/use-page-data";

export default function FavouritesPage() {
  // The layout's SessionProvider already sent signed-out visitors to login.
  const page = usePageData("favourites", getFavourites);
  if (!page.data) return <PageSkeleton />;
  const favourites = page.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Saved Favourites</h1>
        <p className="text-muted-foreground text-sm">
          {favourites.length === 0
            ? "You haven't saved any vehicles yet."
            : `You have ${favourites.length} saved vehicle${favourites.length !== 1 ? "s" : ""}.`}
        </p>
      </div>
      <ShowroomGrid vehicles={favourites} favouriteIds={favourites.map((v) => v.id as string)} />
    </div>
  );
}
