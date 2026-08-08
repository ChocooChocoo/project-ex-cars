import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/(auth)/actions";
import { landingPath } from "@/lib/routing/paths";

export default async function Home() {
  const role = await getCurrentRole();
  if (role) {
    redirect(landingPath(role));
  }

  redirect("/auth/v1/login");
}
