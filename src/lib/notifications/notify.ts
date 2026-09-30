// Writes one notification with the service role. Not a "use server" module: callers are
// role-guarded server actions, and this must never be callable from the client.

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function notify(
  admin: Admin,
  to: { role: string } | { userId: string },
  message: { kind: string; title: string; body: string; transactionId: string },
): Promise<void> {
  await admin.from("notifications").insert({
    recipient_role: "role" in to ? to.role : null,
    recipient_id: "userId" in to ? to.userId : null,
    kind: message.kind,
    title: message.title,
    body: message.body,
    reference_table: "transactions",
    reference_id: message.transactionId,
  });
}
