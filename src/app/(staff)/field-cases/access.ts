import { z } from "zod";

import { getCurrentRole } from "@/lib/auth/server-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AssignedCase {
  id: string;
  transaction_id: string | null;
  case_kind: string;
  state: string;
  assigned_confidential_informant: string | null;
  mechanic_id: string | null;
  identity_confirmed_at: string | null;
  plate_confirmed_at: string | null;
  inspection_outcome: string | null;
}

// The case columns that tie a worker to it, whichever team the case belongs to.
export function isAssigned(
  fieldCase: { assigned_confidential_informant?: unknown; mechanic_id?: unknown; head_security_id?: unknown },
  userId: string,
): boolean {
  if (!userId) return false;
  const team = [fieldCase.assigned_confidential_informant, fieldCase.mechanic_id, fieldCase.head_security_id];
  return team.some((member) => member === userId);
}

// Loads a field case the caller is assigned to. The field roles cannot read transactions under
// RLS, so these steps run with the service role behind this assignment check.
//
// `allowRole` opens the helper to the overseeing roles (CEO, Sales Manager): they may act on any
// case without being named on it, exactly as the office roles can read every case.
export async function assignedCase(
  fieldCaseId: unknown,
  options?: { allowRole?: (role: string) => boolean },
): Promise<{ userId: string; role: string; fieldCase: AssignedCase } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  const id = z.string().uuid().safeParse(fieldCaseId);
  if (!id.success) return { error: "Invalid field case." };

  const { data: fieldCase } = await createAdminClient()
    .from("field_cases")
    .select(
      "id, transaction_id, case_kind, state, assigned_confidential_informant, mechanic_id, identity_confirmed_at, plate_confirmed_at, inspection_outcome",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (!fieldCase) return { error: "Field case not found." };

  const assigned =
    (role === "confidential_informant" && fieldCase.assigned_confidential_informant === data.user.id) ||
    (role === "mechanic" && fieldCase.mechanic_id === data.user.id);
  const exempt = role ? options?.allowRole?.(role) === true : false;
  if (!role || !(assigned || exempt)) return { error: "Only the assigned field team can update this case." };
  if (["completed", "cancelled"].includes(fieldCase.state)) return { error: "This field case is closed." };
  return { userId: data.user.id, role, fieldCase: fieldCase as AssignedCase };
}
