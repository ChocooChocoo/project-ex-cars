import { createAdminClient } from "@/lib/supabase/admin";

export async function logAuditEvent(params: {
  actorId: string;
  action: string;
  recordKind: string;
  recordId: string;
  summary: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_events").insert({
    actor_id: params.actorId,
    action: params.action,
    record_kind: params.recordKind,
    record_id: params.recordId,
    summary: params.summary,
  });

  if (error) {
    console.error("Audit log failed:", error);
  }
}
