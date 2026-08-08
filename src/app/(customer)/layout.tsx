import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase/server";

export default async function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/v1/login");
  }

  return <>{children}</>;
}
