import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Announcements</h1>
          <p className="text-muted-foreground text-sm">
            {isCeo ? "Manage company announcements." : "Stay updated with the latest news."}
          </p>
        </div>
      </div>

      {(announcements ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No announcements yet.</CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {(announcements ?? []).map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{a.title as string}</CardTitle>
                  <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-xs">
                    {a.status as string}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{a.body as string}</p>
                {a.published_at && (
                  <p className="mt-2 text-muted-foreground text-xs">
                    {new Date(a.published_at as string).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
