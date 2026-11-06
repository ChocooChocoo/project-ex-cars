"use server";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LocationResult = { error: string } | { success: true; lat: number | null; lng: number | null; at: string | null };

const uuid = z.string().uuid();

// The customer who owns the transaction and the team assigned to the case may read its last location.
// The polling component calls this every 15 seconds while a delivery or recovery is active.
export async function getFieldCaseLocation(fieldCaseId: string): Promise<LocationResult> {
  const parsed = uuid.safeParse(fieldCaseId);
  if (!parsed.success) return { error: "Invalid case." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const role = await getCurrentRole();

  const admin = createAdminClient();
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select(
      "id, transaction_id, assigned_confidential_informant, mechanic_id, head_security_id, last_lat, last_lng, last_located_at",
    )
    .eq("id", parsed.data)
    .maybeSingle();
  if (!fieldCase) return { error: "Case not found." };

  const namedTeam = [fieldCase.assigned_confidential_informant, fieldCase.mechanic_id, fieldCase.head_security_id];
  let allowed = namedTeam.includes(user.id);
  if (!allowed && role === "customer" && fieldCase.transaction_id) {
    const { data: transaction } = await admin
      .from("transactions")
      .select("customer_id")
      .eq("id", fieldCase.transaction_id)
      .maybeSingle();
    allowed = transaction?.customer_id === user.id;
  }
  if (!allowed && ["ceo", "head_accountant", "sales_manager", "marketing_specialist"].includes(role ?? "")) {
    allowed = true;
  }
  if (!allowed) return { error: "Not authorized to view this location." };

  return {
    success: true,
    lat: fieldCase.last_lat == null ? null : Number(fieldCase.last_lat),
    lng: fieldCase.last_lng == null ? null : Number(fieldCase.last_lng),
    at: (fieldCase.last_located_at as string | null) ?? null,
  };
}
