import { requireRole } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";

import { ContentManager } from "./_components/content-manager";

export default async function ContentPage() {
  await requireRole(["ceo", "marketing_specialist"]);
  const supabase = await createServerSupabase();

  const { data: items } = await supabase.from("content_items").select("*").order("created_at", { ascending: false });

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, year")
    .order("created_at", { ascending: false });

  return (
    <ContentManager
      items={(items as Record<string, unknown>[]) ?? []}
      vehicles={(vehicles as Record<string, unknown>[]) ?? []}
    />
  );
}
