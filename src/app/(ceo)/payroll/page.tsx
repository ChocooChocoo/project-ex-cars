import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { PayrollClient, type PayrollRunRow } from "./_components/payroll-client";

const PAYROLL_ROLES = ["ceo", "account_manager", "head_accountant"];

export default async function PayrollPage() {
  const role = await getCurrentRole();
  if (!role || !PAYROLL_ROLES.includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: runs } = await supabase.from("payroll_runs").select("*").order("created_at", { ascending: false });

  return (
    <PayrollClient
      runs={(runs as unknown as PayrollRunRow[]) ?? []}
      canPrepare={["ceo", "account_manager"].includes(role)}
      canReview={["ceo", "head_accountant"].includes(role)}
      canFinalize={role === "head_accountant"}
    />
  );
}
