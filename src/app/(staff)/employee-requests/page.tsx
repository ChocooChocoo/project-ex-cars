import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

import { type EmployeeRequestRow, EmployeeRequestsClient } from "./_components/employee-requests-client";

const REQUEST_REVIEWERS = ["ceo", "account_manager"];

export default async function EmployeeRequestsPage() {
  await requireRole(STAFF_ROLES);
  const role = (await getCurrentRole()) as string;
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const canReview = REQUEST_REVIEWERS.includes(role);
  const query = supabase.from("employee_requests").select("*").order("created_at", { ascending: false });
  if (!canReview) {
    query.eq("employee_id", user.id);
  }

  const { data: requests } = await query;

  return (
    <EmployeeRequestsClient
      requests={(requests as unknown as EmployeeRequestRow[]) ?? []}
      canReview={canReview}
      canSubmit
    />
  );
}
