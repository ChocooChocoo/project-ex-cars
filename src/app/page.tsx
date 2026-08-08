import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { landingPath } from "@/lib/routing/paths";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/v1/login");
  }

  const role = await getCurrentRole();
  if (role) {
    redirect(landingPath(role));
  }

  redirect("/auth/v1/login");
}
