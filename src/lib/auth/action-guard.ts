import { type ActionResult, notAuthenticated, notAuthorized } from "@/lib/auth/action-result";
import type { GceRole } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

export interface AuthorizedContext {
  userId: string;
  role: GceRole;
}

export async function authorizeAction(allowedRoles: readonly GceRole[]): Promise<ActionResult<AuthorizedContext>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return notAuthenticated();
  }

  const { data: roles } = await supabase.rpc("get_user_roles");

  if (!roles || !Array.isArray(roles)) {
    return notAuthorized("No role assigned to your account.");
  }

  const userRole = (roles as { account_id: string; role: string }[]).find((r) => r.account_id === user.id);

  if (!userRole) {
    return notAuthorized("No active role assigned to your account.");
  }

  if (!allowedRoles.includes(userRole.role as GceRole)) {
    return notAuthorized();
  }

  return { ok: true, data: { userId: user.id, role: userRole.role as GceRole } };
}

export function guardActionResult<T extends Record<string, unknown>>(
  result: ActionResult<T>,
): result is { ok: true; data: T } {
  return result.ok;
}
