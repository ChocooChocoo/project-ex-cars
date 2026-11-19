import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase 7: staff operations actions are thin browser adapters. Their rules are asserted where they now run
// (backend/tests/Feature/Staff/*); this checks the wiring: endpoint, body and the old result shapes.
const { api, revalidate } = vi.hoisted(() => ({ api: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ browserApi: api }));
vi.mock("@/lib/api/revalidate", () => ({ revalidatePath: revalidate }));

import * as announcements from "@/app/(staff)/announcements/actions";
import * as attendance from "@/app/(staff)/attendance/actions";
import * as requests from "@/app/(staff)/employee-requests/actions";
import * as payroll from "@/app/(staff)/payroll/actions";
import * as reports from "@/app/(staff)/reports/actions";
import * as roadmap from "@/app/(staff)/roadmap/actions";
import * as rbac from "@/app/(staff)/roles/actions";
import * as duty from "@/app/(staff)/security-duty-checks/actions";
import * as settings from "@/app/(staff)/settings/actions";
import * as records from "@/app/(staff)/staff-records/actions";
import { ApiError } from "@/lib/api/errors";

const ID = "11111111-1111-4111-8111-111111111111";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mockResolvedValue({ success: true });
});

describe("attendance adapters", () => {
  it("posts clock-in with the location and refuses an invalid one locally", async () => {
    api.mockResolvedValue({ row: { id: ID } });
    await expect(attendance.clockIn(14.3, 120.9, 10)).resolves.toEqual({ row: { id: ID } });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/attendance/clock-in", {
      lat: 14.3,
      lng: 120.9,
      accuracy: 10,
    });
    expect(revalidate).toHaveBeenCalled();
    await expect(attendance.clockIn(Number.NaN, 1, 1)).resolves.toEqual({ error: "Invalid location." });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("sends the review form as JSON and passes Laravel's refusal through", async () => {
    api.mockRejectedValue(new ApiError(409, { message: "Attendance has already been checked." }));
    const result = await attendance.checkAttendance(
      form({ id: ID, attendance_date: "2026-11-23", status: "late", notes: "" }),
    );
    expect(result).toEqual({ error: "Attendance has already been checked." });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/attendance/review", {
      id: ID,
      status: "late",
      notes: null,
    });
  });

  it("reads the clock state", async () => {
    api.mockResolvedValue({ state: { clock_in_allowed: true } });
    await expect(attendance.getMyAttendanceState()).resolves.toEqual({
      success: true,
      state: { clock_in_allowed: true },
    });
    expect(api).toHaveBeenLastCalledWith("GET", "/api/v1/staff/attendance/state");
  });
});

describe("staff record adapters", () => {
  it("maps the staff record form to the save endpoint and validates the returned shape", async () => {
    const profile = { id: ID, account_state: "active", full_name: "Ada", phone: null, address: null };
    const schedule = {
      id: ID,
      employee_id: ID,
      workdays: [1, 2],
      start_time: "08:00:00",
      end_time: "17:00:00",
      grace_minutes: 10,
      timezone: "Asia/Manila",
    };
    api.mockResolvedValue({ row: profile, schedule });
    const fd = form({
      accountId: ID,
      fullName: "Ada",
      phone: "",
      address: "",
      workdays: "1,2",
      startTime: "08:00",
      endTime: "17:00",
      graceMinutes: "10",
    });
    await expect(records.saveStaffRecord(fd)).resolves.toEqual({ success: true, row: profile, schedule });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/staff-records/save", {
      account_id: ID,
      full_name: "Ada",
      phone: null,
      address: null,
      workdays: [1, 2],
      start_time: "08:00",
      end_time: "17:00",
      grace_minutes: 10,
    });
  });

  it("changes account state through the admin endpoint", async () => {
    const profile = { id: ID, account_state: "suspended", full_name: "Ada", phone: null, address: null };
    api.mockResolvedValue({ row: profile, schedule: null });
    await expect(records.updateAccountState(form({ accountId: ID, state: "suspended" }))).resolves.toEqual({
      success: true,
    });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/admin/account-state", { account_id: ID, state: "suspended" });
    await expect(records.setAccountState(form({ accountId: ID, state: "gone" }))).resolves.toHaveProperty("error");
  });

  it("posts performance reviews without a reviewer id (Laravel uses the session)", async () => {
    const fd = form({
      employee_id: ID,
      review_period_start: "2026-10-01",
      review_period_end: "2026-10-31",
      rating: "4",
      goals: "",
    });
    await expect(records.submitPerformanceReview(fd)).resolves.toEqual({ success: true });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/staff-records/performance-reviews", {
      employee_id: ID,
      review_period_start: "2026-10-01",
      review_period_end: "2026-10-31",
      rating: 4,
      strengths: null,
      areas_for_improvement: null,
      goals: null,
    });
    fd.set("review_id", ID);
    await records.updatePerformanceReview(fd);
    expect(api).toHaveBeenLastCalledWith(
      "POST",
      "/api/v1/staff/staff-records/performance-reviews/update",
      expect.objectContaining({ review_id: ID }),
    );
  });
});

describe("employee request adapters", () => {
  it("posts the request form with its proof files as multipart", async () => {
    const fd = form({ request_kind: "leave", start_date: "2026-11-24", end_date: "", leave_reason: "sick" });
    fd.append("proofs[]", new File(["x"], "note.jpg", { type: "image/jpeg" }));
    await expect(requests.submitEmployeeRequest(fd)).resolves.toEqual({ success: true });
    const [method, path, body] = api.mock.calls[0];
    expect([method, path]).toEqual(["POST", "/api/v1/staff/employee-requests"]);
    expect((body as FormData).getAll("proofs[]")).toHaveLength(1);
    await expect(
      requests.submitEmployeeRequest(form({ request_kind: "other", start_date: "2026-11-24" })),
    ).resolves.toEqual({
      error: expect.any(String),
    });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("sends cancel and review to their own routes", async () => {
    await requests.cancelEmployeeRequest(form({ request_id: ID }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/employee-requests/cancel", { request_id: ID });
    await requests.reviewEmployeeRequest(form({ request_id: ID, decision: "approved", review_notes: "" }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/employee-requests/review", {
      request_id: ID,
      decision: "approved",
      review_notes: "",
    });
  });
});

describe("payroll adapters", () => {
  it("posts each payroll form to its endpoint without actor fields", async () => {
    await payroll.createPayrollRun(form({ period_start: "2026-10-01", period_end: "2026-10-31", notes: "" }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payroll/runs", {
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      notes: "",
    });
    await payroll.reviewPayrollRun(form({ payroll_run_id: ID, decision: "approved" }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payroll/runs/review", {
      payroll_run_id: ID,
      decision: "approved",
    });
    await payroll.finalizePayrollRun(form({ payroll_run_id: ID }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payroll/runs/finalize", { payroll_run_id: ID });
    await payroll.markPayslipPaid(form({ payslip_id: ID }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payroll/payslips/mark-paid", { payslip_id: ID });
    await payroll.addPayslipItem(form({ payslip_id: ID, item_kind: "earning", label: "Bonus", amount_cents: "100" }));
    expect(api).toHaveBeenLastCalledWith(
      "POST",
      "/api/v1/staff/payroll/payslip-items",
      expect.objectContaining({ amount_cents: 100 }),
    );
    await payroll.saveCompensation(
      form({
        employee_id: ID,
        base_salary_cents: "2700000",
        effective_from: "2026-01-01",
        effective_until: "",
        tin_number: "",
      }),
    );
    expect(api).toHaveBeenLastCalledWith(
      "POST",
      "/api/v1/staff/payroll/compensation",
      expect.objectContaining({ base_salary_cents: 2_700_000, effective_until: null, tin_number: null }),
    );
  });

  it("loads a run detail and refuses a bad id locally", async () => {
    api.mockResolvedValue({ run: { id: ID } });
    await expect(payroll.getPayrollRunDetail(ID)).resolves.toEqual({ success: true, run: { id: ID } });
    expect(api).toHaveBeenLastCalledWith("GET", `/api/v1/staff/payroll/runs/${ID}`);
    await expect(payroll.getPayrollRunDetail("x")).resolves.toEqual({ error: "Invalid payroll run." });
  });
});

describe("reports, announcements, duty checks and roadmap adapters", () => {
  it("routes each action to its endpoint", async () => {
    await reports.submitReport(form({ report_kind: "sales", title: "October", description: "" }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/reports", {
      report_kind: "sales",
      title: "October",
      description: null,
      period_start: null,
      period_end: null,
    });
    await reports.reviewReport(form({ report_id: ID }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/reports/review", { report_id: ID });
    await announcements.publishAnnouncement(form({ announcement_id: ID }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/announcements/published", { announcement_id: ID });
    await announcements.archiveAnnouncement(form({ announcement_id: ID }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/announcements/archived", { announcement_id: ID });
    await duty.startDutyCheck(form({ duty_date: "2026-11-23" }));
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/security-duty-checks", { duty_date: "2026-11-23" });
    await roadmap.deleteRoadmapItem(ID);
    expect(api).toHaveBeenLastCalledWith("DELETE", `/api/v1/staff/roadmap/${ID}`, undefined);
  });

  it("sends duty evidence as multipart and refuses a non-image locally", async () => {
    const fd = form({ duty_check_id: ID, slot: "before" });
    fd.set("image", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await duty.uploadDutyEvidence(fd);
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/security-duty-checks/evidence", fd);
    const bad = form({ duty_check_id: ID, slot: "before" });
    bad.set("image", new File(["x"], "a.txt", { type: "text/plain" }));
    await expect(duty.uploadDutyEvidence(bad)).resolves.toEqual({
      error: "Only JPEG, PNG, or WebP images are allowed.",
    });
  });

  it("returns the new roadmap id", async () => {
    api.mockResolvedValue({ success: true, id: ID });
    await expect(
      roadmap.createRoadmapItem(form({ kind: "initiative", title: "Showroom", status: "planned", priority: "high" })),
    ).resolves.toEqual({ success: true, id: ID });
  });
});

describe("administration adapters", () => {
  it("maps the RBAC forms to snake_case and dedupes permission ids", async () => {
    const fd = form({ roleKey: "mechanic", description: "", status: "active", isProtected: "true" });
    fd.append("permissionIds", ID);
    fd.append("permissionIds", ID);
    await rbac.updateRbacRole(fd);
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/admin/rbac/roles/update", {
      role_key: "mechanic",
      description: null,
      status: "active",
      is_protected: true,
      permission_ids: [ID],
    });
    await rbac.createRbacPermission(form({ accessAreaKey: "finance", actionKey: "read", status: "active" }));
    expect(api).toHaveBeenLastCalledWith(
      "POST",
      "/api/v1/admin/rbac/permissions",
      expect.objectContaining({ access_area_key: "finance" }),
    );
  });

  it("saves the financing markup and returns the stored value", async () => {
    api.mockResolvedValue({ success: true, pct: 12.5 });
    await expect(settings.updateFinancingMarkup("12.5")).resolves.toEqual({ success: true, pct: 12.5 });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/admin/settings/financing-markup", { value: 12.5 });
    await expect(settings.updateFinancingMarkup(-1)).resolves.toEqual({ error: "The profit cannot be negative." });
  });
});
