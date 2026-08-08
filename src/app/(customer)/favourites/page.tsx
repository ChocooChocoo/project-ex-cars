import { redirect } from "next/navigation";

import { CustomerHeader } from "@/app/(customer)/_components/customer-header";
import { ShowroomGrid } from "@/app/(customer)/showroom/_components/showroom-grid";
import { getFavourites } from "@/app/(staff)/vehicles/actions";
import { getCurrentRole } from "@/app/auth/actions";

export default async function FavouritesPage() {
  const role = await getCurrentRole();
  if (!role) {
    redirect("/auth/v1/login");
  }

  const favourites = await getFavourites();

  return (
    <div className="flex flex-col gap-6">
      <CustomerHeader userRole={role} />
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
