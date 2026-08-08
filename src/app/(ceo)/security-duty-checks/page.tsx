import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SecurityDutyChecksPage() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "head_security"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const query = supabase.from("security_duty_checks").select("*").order("duty_date", { ascending: false });
  if (role === "head_security") {
    query.eq("security_id", user.id);
  }

  const { data: checks } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Security Duty Checks</h1>
        <p className="text-muted-foreground text-sm">Before-and-after evidence for security shifts.</p>
      </div>

      {(checks ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-muted-foreground">No duty checks recorded.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(checks ?? []).map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{new Date(c.duty_date as string).toLocaleDateString()}</CardTitle>
                  <Badge variant={c.status === "completed" ? "default" : "secondary"}>{c.status as string}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Before</span>
                    <p className="font-medium">{c.before_image_path ? "Uploaded" : "Pending"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">After</span>
                    <p className="font-medium">{c.after_image_path ? "Uploaded" : "Pending"}</p>
                  </div>
                </div>
                {c.notes && <p className="text-muted-foreground text-xs">{(c.notes as string).slice(0, 100)}</p>}
                {c.status !== "completed" && role === "head_security" && (
                  <Button variant="outline" size="sm" className="w-full">
                    Complete Check
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
