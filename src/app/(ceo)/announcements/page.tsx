import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { type AnnouncementRow, AnnouncementsClient } from "./_components/announcements-client";

export default async function AnnouncementsPage() {
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();

  const isCeo = role === "ceo";
  const query = supabase.from("announcements").select("*").order("created_at", { ascending: false });
  if (!isCeo) {
    query.eq("status", "published").or("expires_at.is.null, expires_at.gte.now()");
  }

  const { data: announcements } = await query;

  return (
    <AnnouncementsClient announcements={(announcements as unknown as AnnouncementRow[]) ?? []} canManage={isCeo} />
  );
}
