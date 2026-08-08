import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import type { GceRole } from "@/lib/auth/roles";

export async function requireRole(allowedRoles: GceRole[]) {
  const role = await getCurrentRole();
  if (!role || !allowedRoles.includes(role as GceRole)) {
    redirect("/unauthorized");
  }
}
