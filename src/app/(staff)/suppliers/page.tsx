import { redirect } from "next/navigation";

import { getCurrentRole, getCurrentUser } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { SupplierAdmin } from "./_components/supplier-admin";

export default async function SuppliersPage() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const [{ data: suppliers }, { data: documents }] = await Promise.all([
    supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
    supabase.from("supplier_documents").select("*").order("created_at", { ascending: false }),
  ]);

  const user = await getCurrentUser();

  return (
    <SupplierAdmin
      suppliers={
        (suppliers ?? []) as {
          id: string;
          business_name: string;
          supplier_kind: string;
          state: string;
          contact_name: string;
          contact_email: string;
          contact_phone: string;
        }[]
      }
      documents={
        (documents ?? []) as {
          id: string;
          supplier_id: string;
          document_kind: string;
          is_primary_id: boolean;
          storage_path: string;
          verification_state: string;
          verified_at: string | null;
        }[]
      }
      userId={user?.id ?? ""}
    />
  );
}
