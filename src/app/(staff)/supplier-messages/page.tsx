import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { SupplierMessageThread } from "./_components/supplier-message-thread";

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

  const isCeo = role === "ceo";

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, business_name")
    .eq("state", "approved")
    .order("created_at", { ascending: true });

  let ownSupplierId: string | null = null;
  if (!isCeo) {
    const { data: own } = await supabase.from("suppliers").select("id").eq("account_id", user.id).maybeSingle();
    ownSupplierId = own?.id ?? null;
  }

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

      <SupplierMessageThread
        messages={
          (messages ?? []) as {
            id: string;
            supplier_id: string;
            sender_id: string;
            message_text: string;
            read_at: string | null;
            created_at: string;
          }[]
        }
        suppliers={
          (suppliers ?? []) as {
            id: string;
            business_name: string;
          }[]
        }
        userId={user.id}
        isCeo={isCeo}
        ownSupplierId={ownSupplierId}
      />
    </div>
  );
}
