import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { type FieldCaseRow, FieldCasesClient } from "./_components/field-cases-client";

const FIELD_CASE_ROLES = [
  "ceo",
  "confidential_informant",
  "sales_manager",
  "mechanic",
  "account_manager",
  "head_accountant",
];
const FIELD_CASE_WORKERS = ["ceo", "confidential_informant", "mechanic", "sales_manager"];
const FIELD_CASE_CREATORS = ["ceo", "confidential_informant", "sales_manager", "head_accountant"];

export default async function FieldCasesPage() {
  const role = await getCurrentRole();
  if (!role || !FIELD_CASE_ROLES.includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: cases } = await supabase.from("field_cases").select("*").order("created_at", { ascending: false });

  const [{ data: informants }, { data: mechanics }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, private_user_roles!inner(role)")
      .eq("private_user_roles.role", "confidential_informant")
      .eq("private_user_roles.active", true),
    supabase
      .from("profiles")
      .select("id, full_name, private_user_roles!inner(role)")
      .eq("private_user_roles.role", "mechanic")
      .eq("private_user_roles.active", true),
  ]);

  return (
    <FieldCasesClient
      cases={(cases as unknown as FieldCaseRow[]) ?? []}
      canUpdate={FIELD_CASE_WORKERS.includes(role)}
      canCreate={FIELD_CASE_CREATORS.includes(role)}
      canAssignMechanic={["ceo", "confidential_informant", "sales_manager"].includes(role)}
      informants={(informants as { id: string; full_name: string | null }[]) ?? []}
      mechanics={(mechanics as { id: string; full_name: string | null }[]) ?? []}
      role={role}
    />
  );
}
