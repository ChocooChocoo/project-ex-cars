import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

import { type DutyCheckRow, SecurityDutyChecksClient } from "./_components/security-duty-checks-client";

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
    <SecurityDutyChecksClient
      checks={(checks as unknown as DutyCheckRow[]) ?? []}
      canManage={role === "head_security"}
    />
  );
}
