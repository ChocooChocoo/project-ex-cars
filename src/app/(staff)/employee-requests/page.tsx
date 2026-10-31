import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { REQUEST_ATTACHMENTS_BUCKET } from "@/lib/inquiries/attachments";
import { signAttachments } from "@/lib/inquiries/attachments-server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LeaveReason, RequestKind } from "@/lib/validation/phase6";

import { EmployeeRequestsClient } from "./_components/employee-requests-client";
import type { EmployeeRequestAttachment, EmployeeRequestRow } from "./_components/employee-requests-columns";

const REQUEST_REVIEWERS = ["ceo", "account_manager"];

// The FK name comes from 00015_phase6_staff_records.sql (employee_requests.employee_id -> profiles.id).
export const EMPLOYEE_REQUEST_SELECT =
  "*, profiles!employee_requests_employee_id_fkey(full_name), employee_request_attachments(*)";

interface EmployeeRequestAttachmentRow extends Record<string, unknown> {
  id: string;
  request_id: string;
  storage_path: string;
  original_name: string;
  file_kind: "image" | "file";
  file_size: number | null;
}

interface EmployeeRequestDbRow {
  id: string;
  employee_id: string;
  request_kind: RequestKind;
  status: EmployeeRequestRow["status"];
  start_date: string;
  end_date: string | null;
  overtime_hours?: number | null;
  leave_reason: LeaveReason | null;
  reason: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  profiles: { full_name: string | null } | null;
  employee_request_attachments: EmployeeRequestAttachmentRow[] | null;
}

export function buildEmployeeRequestRows(
  rows: EmployeeRequestDbRow[],
  signedUrls: Map<string, string | null>,
): EmployeeRequestRow[] {
  return rows.map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    employee_name: row.profiles?.full_name ?? null,
    request_kind: row.request_kind,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    overtime_hours: row.overtime_hours ?? null,
    leave_reason: row.leave_reason,
    reason: row.reason,
    review_notes: row.review_notes,
    reviewed_at: row.reviewed_at,
    employee_request_attachments: (row.employee_request_attachments ?? []).map(
      (attachment): EmployeeRequestAttachment => ({
        id: attachment.id,
        request_id: attachment.request_id,
        original_name: attachment.original_name,
        file_kind: attachment.file_kind,
        file_size: attachment.file_size,
        signed_url: signedUrls.get(attachment.id) ?? null,
      }),
    ),
  }));
}

export default async function EmployeeRequestsPage() {
  await requireRole(STAFF_ROLES);
  const role = (await getCurrentRole()) as string;
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const canReview = REQUEST_REVIEWERS.includes(role);
  const query = supabase
    .from("employee_requests")
    .select(EMPLOYEE_REQUEST_SELECT)
    .order("created_at", { ascending: false });
  if (!canReview) {
    query.eq("employee_id", user.id);
  }

  const { data } = await query.returns<EmployeeRequestDbRow[]>();
  const rows = data ?? [];

  // One signing pass for every proof file the page shows; the RLS-checked read above proves access.
  const signed = await signAttachments(
    rows.flatMap((row) => row.employee_request_attachments ?? []),
    REQUEST_ATTACHMENTS_BUCKET,
  );
  const signedUrls = new Map(signed.map((attachment) => [attachment.id, attachment.signed_url]));

  return (
    <EmployeeRequestsClient requests={buildEmployeeRequestRows(rows, signedUrls)} canReview={canReview} canSubmit />
  );
}
