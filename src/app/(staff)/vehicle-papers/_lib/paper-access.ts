// T11: who may open a printable paper. The paper's own staff roles read every paper; the buyer reads their
// own, so they can keep a copy of what they signed; and the Confidential Informant assigned to the
// transaction's field case reads the papers they carry. Everyone else redirects to /unauthorized.

import { redirect } from "next/navigation";

import type { GceRole } from "@/lib/auth/roles";
import { getCurrentRole } from "@/lib/auth/server-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

// The sales staff who print the financing papers: the CEO, the Head Accountant and the Sales Manager.
export const PAPER_ROLES: GceRole[] = ["ceo", "head_accountant", "sales_manager"];

/** The buyer of the transaction, or the CI assigned to its delivery / meet-up field case. */
export async function isPaperReader(admin: Admin, transactionId: string, userId: string): Promise<boolean> {
  const [{ data: transaction }, { data: fieldCase }] = await Promise.all([
    admin.from("transactions").select("id, customer_id").eq("id", transactionId).maybeSingle(),
    admin
      .from("field_cases")
      .select("id, assigned_confidential_informant")
      .eq("transaction_id", transactionId)
      .in("case_kind", ["delivery", "buyer_meetup"])
      .neq("state", "cancelled")
      .maybeSingle(),
  ]);
  return transaction?.customer_id === userId || fieldCase?.assigned_confidential_informant === userId;
}

/**
 * Guards one printable paper. Allows `staffRoles`, the buyer of the transaction, and the Confidential
 * Informant assigned to its field case; anyone else gets the same /unauthorized screen `requireRole` sends
 * them to. The CI and the buyer cannot read a transaction under RLS, so their check uses the service role.
 */
export async function requirePaperReader(transactionId: string, staffRoles: GceRole[]): Promise<void> {
  const role = await getCurrentRole();
  if (role && staffRoles.includes(role as GceRole)) return;
  const {
    data: { user },
  } = await (await createServerSupabase()).auth.getUser();
  if (user && (await isPaperReader(createAdminClient(), transactionId, user.id))) return;
  redirect("/unauthorized");
}
