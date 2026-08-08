import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { type ReportRow, ReportsClient } from "./_components/reports-client";

const REPORT_ROLES = ["ceo", "head_accountant", "account_manager"];

export default async function ReportsPage() {
  const role = await getCurrentRole();
  if (!role || !REPORT_ROLES.includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: reports } = await supabase.from("reports").select("*").order("created_at", { ascending: false });

  return (
    <ReportsClient
      reports={(reports as unknown as ReportRow[]) ?? []}
      canCreate={["ceo", "head_accountant", "account_manager"].includes(role)}
      canReview={["ceo", "head_accountant"].includes(role)}
    />
  );
}
