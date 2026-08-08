import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { type CompensationRow, PayrollClient, type PayrollRunRow } from "./_components/payroll-client";

const PAYROLL_ROLES = ["ceo", "account_manager", "head_accountant"];

export default async function PayrollPage() {
  const role = await getCurrentRole();
  if (!role || !PAYROLL_ROLES.includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: runs } = await supabase.from("payroll_runs").select("*").order("created_at", { ascending: false });

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, private_user_roles!inner(role)")
    .not("private_user_roles.role", "in", '("customer","supplier")');

  const admin = await import("@/lib/supabase/admin").then((m) => m.createAdminClient());
  const { data: compensation } = await admin
    .from("staff_compensation")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  return (
    <PayrollClient
      runs={(runs as unknown as PayrollRunRow[]) ?? []}
      compensation={(compensation as unknown as CompensationRow[]) ?? []}
      employees={(employees as unknown as { id: string; full_name: string | null }[]) ?? []}
      canPrepare={["ceo", "account_manager"].includes(role)}
      canReview={["ceo", "head_accountant"].includes(role)}
      canFinalize={role === "head_accountant"}
    />
  );
}
