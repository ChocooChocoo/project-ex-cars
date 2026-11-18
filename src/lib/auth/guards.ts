import { redirect } from "next/navigation";

import type { GceRole } from "@/lib/auth/roles";
import { getCurrentRole } from "@/lib/auth/server-session";

export async function requireRole(allowedRoles: GceRole[]) {
  const role = await getCurrentRole();
  if (!role || !allowedRoles.includes(role as GceRole)) {
    redirect("/unauthorized");
  }
}
