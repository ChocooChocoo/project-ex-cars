import { toActionFailure } from "@/lib/api/errors";
import { type ActionResult, notAuthenticated, notAuthorized } from "@/lib/auth/action-result";
import type { GceRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";

export interface AuthorizedContext {
  userId: string;
  role: GceRole;
}

/**
 * Early, UI-friendly check in a Server Action. It is not the security boundary: Laravel re-authorises
 * every API call from the session. The user and role come from Laravel, never from a cookie or form field.
 */
export async function authorizeAction(allowedRoles: readonly GceRole[]): Promise<ActionResult<AuthorizedContext>> {
  let me: Awaited<ReturnType<typeof getSession>>;
  try {
    me = await getSession();
  } catch (error) {
    return toActionFailure(error);
  }

  if (!me) return notAuthenticated();
  if (!me.role) return notAuthorized("No active role assigned to your account.");
  if (!allowedRoles.includes(me.role)) return notAuthorized();

  return { ok: true, data: { userId: me.id, role: me.role } };
}

export function guardActionResult<T extends Record<string, unknown>>(
  result: ActionResult<T>,
): result is { ok: true; data: T } {
  return result.ok;
}
