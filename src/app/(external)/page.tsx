import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/(main)/auth/actions";
import { ROLE_LANDING_PAGES } from "@/lib/auth/roles";

export default async function Home() {
  const role = await getCurrentRole();
  if (role) {
    const landing = ROLE_LANDING_PAGES[role as keyof typeof ROLE_LANDING_PAGES] ?? "/dashboard/default";
    redirect(landing);
  }

  redirect("/auth/v1/login");
}
