// Server-side building blocks for the Meet Halfway field case. Not a "use server" module: these write
// with the service role and must only run behind a role-guarded action.

import { notify } from "@/lib/notifications/notify";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;
type Server = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// The same worker check as the delivery team: each pick must be an active holder of its role.
export async function meetupTeamError(supabase: Server, informantId: string, mechanicId: string) {
  const { data: workers } = await supabase.rpc("list_field_case_workers");
  const directory = (workers as { account_id: string; role: string }[] | null) ?? [];
  const is = (id: string, role: string) => directory.some((w) => w.account_id === id && w.role === role);
  if (!is(informantId, "confidential_informant")) return "Choose an active Confidential Informant.";
  if (!is(mechanicId, "mechanic")) return "Choose an active Mechanic.";
  return null;
}

// The booked meet-up of a request, if the buyer has one.
export async function bookedMeetup(admin: Admin, transactionId: string) {
  const { data } = await admin
    .from("viewing_arrangements")
    .select("schedule, location")
    .eq("purchase_transaction_id", transactionId)
    .eq("arrangement_kind", "meetup")
    .in("confirmation_state", ["pending", "confirmed"])
    .maybeSingle();
  return data as { schedule: string; location: string | null } | null;
}

// Creates the meet-up field case for the chosen Confidential Informant and Mechanic and sends them the
// command. Returns an error message, or null.
export async function openMeetupCase(
  admin: Admin,
  sale: { id: string; vehicle_id: string | null; current_state: string },
  team: { informantId: string; mechanicId: string },
  meetup: { schedule: string; location: string | null },
  actorId: string,
): Promise<string | null> {
  const { error } = await admin.from("field_cases").insert({
    transaction_id: sale.id,
    vehicle_id: sale.vehicle_id,
    case_kind: "buyer_meetup",
    assigned_confidential_informant: team.informantId,
    mechanic_id: team.mechanicId,
    schedule: meetup.schedule,
    location: meetup.location,
    state: "assigned",
    notes: "Meet Halfway. The Confidential Informant carries the vehicle papers.",
  });
  if (error) return error.message;

  await admin.from("transaction_status_history").insert({
    transaction_id: sale.id,
    from_state: sale.current_state,
    to_state: sale.current_state,
    actor_id: actorId,
    reason: "Meet-up team assigned",
  });
  for (const workerId of [team.informantId, team.mechanicId]) {
    await notify(
      admin,
      { userId: workerId },
      {
        kind: "field_case_assigned",
        title: "You have a client to meet halfway",
        body: `Meet the buyer on ${new Date(meetup.schedule).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} at ${meetup.location ?? "the agreed place"}. Open the field case for the vehicle and the buyer, and receive it.`,
        transactionId: sale.id,
      },
    );
  }
  return null;
}
