import { redirect } from "next/navigation";

import { format } from "date-fns";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

import { GCE_ROLE_LABELS, mapAccountState, type UserRow } from "./_components/data";
import { Users } from "./_components/users";

export default async function Page() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, account_state, created_at"),
    supabase.rpc("get_all_user_roles"),
  ]);

  const admin = createAdminClient();
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email]));

  const users: UserRow[] = (profiles ?? []).map((profile) => {
    const roleRecord = (roles as { account_id: string; role: string }[] | null)?.find(
      (r) => r.account_id === profile.id,
    );
    const roleKey = roleRecord?.role ?? "customer";
    return {
      email: emailById.get(profile.id) ?? "",
      joinedDate: profile.created_at ? format(new Date(profile.created_at as string), "dd MMM yyyy, h:mm a") : "",
      lastActive: 0,
      name: profile.full_name ?? "Unknown user",
      role: GCE_ROLE_LABELS[roleKey] ?? roleKey,
      status: mapAccountState(profile.account_state as string),
      team: "GCE",
      workspace: ["GCE"],
    };
  });

  return <Users users={users} />;
}
