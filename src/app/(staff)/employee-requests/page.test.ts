import { describe, expect, it } from "vitest";

import { buildEmployeeRequestRows, EMPLOYEE_REQUEST_SELECT } from "./page";

describe("employee requests page data loading", () => {
  it("qualifies the employee profile relationship and reads the proof files", () => {
    expect(EMPLOYEE_REQUEST_SELECT).toContain("profiles!employee_requests_employee_id_fkey(full_name)");
    expect(EMPLOYEE_REQUEST_SELECT).toContain("employee_request_attachments(*)");
  });

  it("puts the requester name and the signed proof links on each row", () => {
    const rows = buildEmployeeRequestRows(
      [
        {
          id: "request-1",
          employee_id: "employee-1",
          request_kind: "leave",
          status: "pending",
          start_date: "2026-11-02",
          end_date: "2026-11-03",
          leave_reason: "sick",
          reason: null,
          review_notes: null,
          reviewed_at: null,
          profiles: { full_name: "Arnel Santiago" },
          employee_request_attachments: [
            {
              id: "attachment-1",
              request_id: "request-1",
              storage_path: "employee-1/proof.pdf",
              original_name: "proof.pdf",
              file_kind: "file",
              file_size: 2048,
            },
          ],
        },
      ],
      new Map([["attachment-1", "https://signed/proof.pdf"]]),
    );

    expect(rows[0]?.employee_name).toBe("Arnel Santiago");
    expect(rows[0]?.employee_request_attachments).toEqual([
      {
        id: "attachment-1",
        request_id: "request-1",
        original_name: "proof.pdf",
        file_kind: "file",
        file_size: 2048,
        signed_url: "https://signed/proof.pdf",
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain("employee-1/proof.pdf");
  });

  it("falls back to an unknown employee when the profile is missing", () => {
    const rows = buildEmployeeRequestRows(
      [
        {
          id: "request-2",
          employee_id: "employee-2",
          request_kind: "overtime",
          status: "approved",
          start_date: "2026-11-02",
          end_date: null,
          leave_reason: null,
          reason: "Month-end closing",
          review_notes: null,
          reviewed_at: null,
          profiles: null,
          employee_request_attachments: null,
        },
      ],
      new Map(),
    );

    expect(rows[0]?.employee_name).toBeNull();
    expect(rows[0]?.employee_request_attachments).toEqual([]);
  });
});
