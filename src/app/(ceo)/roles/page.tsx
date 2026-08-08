import { createServerSupabase } from "@/lib/supabase/server";

import { RolesManager } from "./_components/roles-manager";

export default async function Page() {
  const supabase = await createServerSupabase();

  const { data: profiles } = await supabase.from("profiles").select("id, full_name, account_state, created_at");

  const { data: roles } = await supabase.rpc("get_user_roles");

  const users = (profiles ?? []).map((p) => {
    const roleRecord = (roles as { account_id: string; role: string }[] | null)?.find((r) => r.account_id === p.id);
    return {
      id: p.id,
      fullName: p.full_name ?? "Unknown",
      accountState: p.account_state,
      role: roleRecord?.role ?? "customer",
      createdAt: p.created_at,
    };
  });

  return <RolesManager users={users} />;
}
