import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SupplierMessagesPage() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "supplier"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const { data: suppliers } = await supabase.from("suppliers").select("*").eq("state", "approved");
  const { data: messages } = await supabase
    .from("supplier_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Supplier Messages</h1>
        <p className="text-muted-foreground text-sm">Direct communication with approved suppliers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approved Suppliers ({suppliers?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(suppliers ?? []).map((s) => (
            <Badge key={s.id} variant="secondary">
              {s.business_name as string}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {(messages ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">No messages yet.</p>
            ) : (
              (messages ?? []).map((m) => (
                <div key={m.id} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {m.sender_id === user.id ? "You" : "Supplier"}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(m.created_at as string).toLocaleString()}
                    </span>
                    {!m.read_at && m.sender_id !== user.id && (
                      <Badge variant="default" className="text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{m.message_text as string}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
