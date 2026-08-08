import { z } from "zod";

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "half_day", "on_leave"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const attendanceSchema = z.object({
  attendance_date: z.string().min(1, "Date is required."),
  status: z.enum(ATTENDANCE_STATUSES),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const REQUEST_KINDS = ["leave", "overtime", "schedule_change", "other"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const employeeRequestSchema = z
  .object({
    request_kind: z.enum(REQUEST_KINDS),
    start_date: z.string().min(1, "Start date is required."),
    end_date: z.string().optional().or(z.literal("")),
    reason: z.string().min(1, "Reason is required.").max(1000),
  })
  .refine(
    (data) => {
      if (!data.end_date) return true;
      return new Date(data.end_date) >= new Date(data.start_date);
    },
    { path: ["end_date"], message: "End date must be on or after the start date." },
  );

export const requestReviewSchema = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  review_notes: z.string().max(1000).optional().or(z.literal("")),
});

export const REVIEW_RATINGS = [1, 2, 3, 4, 5] as const;

export const performanceReviewSchema = z.object({
  employee_id: z.string().uuid(),
  review_period_start: z.string().min(1, "Period start is required."),
  review_period_end: z.string().min(1, "Period end is required."),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  strengths: z.string().max(2000).optional().or(z.literal("")),
  areas_for_improvement: z.string().max(2000).optional().or(z.literal("")),
  goals: z.string().max(2000).optional().or(z.literal("")),
});

export const compensationSchema = z.object({
  employee_id: z.string().uuid(),
  base_salary_cents: z.coerce.number().int().min(1, "Salary must be greater than zero."),
  effective_from: z.string().min(1, "Effective date is required."),
  effective_until: z.string().optional().or(z.literal("")),
  sss_contribution_cents: z.coerce.number().int().min(0).default(0),
  pagibig_contribution_cents: z.coerce.number().int().min(0).default(0),
  philhealth_contribution_cents: z.coerce.number().int().min(0).default(0),
  tin_number: z.string().max(20).optional().or(z.literal("")),
});

export const payrollRunSchema = z
  .object({
    period_start: z.string().min(1, "Period start is required."),
    period_end: z.string().min(1, "Period end is required."),
    notes: z.string().max(1000).optional().or(z.literal("")),
  })
  .refine((data) => new Date(data.period_end) >= new Date(data.period_start), {
    path: ["period_end"],
    message: "Period end must be on or after the period start.",
  });

export const payrollApprovalSchema = z.object({
  payroll_run_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const payslipItemSchema = z.object({
  payslip_id: z.string().uuid(),
  item_kind: z.enum(["earning", "deduction"]),
  label: z.string().min(1, "Label is required.").max(200),
  amount_cents: z.coerce.number().int().min(0, "Amount cannot be negative."),
  source_value: z.string().max(500).optional().or(z.literal("")),
  calculation_note: z.string().max(1000).optional().or(z.literal("")),
});

export const REPORT_KINDS = [
  "attendance",
  "payroll",
  "disbursement",
  "expense",
  "revenue",
  "inventory",
  "sales",
  "management",
  "other",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const reportSchema = z.object({
  report_kind: z.enum(REPORT_KINDS),
  title: z.string().min(1, "Title is required.").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  period_start: z.string().optional().or(z.literal("")),
  period_end: z.string().optional().or(z.literal("")),
});

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200),
  body: z.string().min(1, "Body is required.").max(5000),
  expires_at: z.string().optional().or(z.literal("")),
});

export const FINANCIAL_ENTRY_KINDS = ["revenue", "expense", "disbursement", "adjustment"] as const;
export type FinancialEntryKind = (typeof FINANCIAL_ENTRY_KINDS)[number];

export const financialEntrySchema = z.object({
  entry_kind: z.enum(FINANCIAL_ENTRY_KINDS),
  amount_cents: z.coerce.number().int().min(0, "Amount cannot be negative."),
  transaction_id: z.string().uuid().optional().or(z.literal("")),
  field_case_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().min(1, "Description is required.").max(500),
});

export const disbursementRequestSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200),
  amount_cents: z.coerce.number().int().min(1, "Amount must be greater than zero."),
  purpose: z.string().min(1, "Purpose is required.").max(1000),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const disbursementEventSchema = z.object({
  disbursement_id: z.string().uuid(),
  event_kind: z.enum(["submitted", "approved", "rejected", "released", "received", "paid"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const FIELD_CASE_STATES = ["assigned", "accepted", "in_progress", "completed", "cancelled"] as const;
export type FieldCaseState = (typeof FIELD_CASE_STATES)[number];

export const fieldCaseUpdateSchema = z.object({
  field_case_id: z.string().uuid(),
  state: z.enum(FIELD_CASE_STATES),
  expenses_cents: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const securityDutyCheckSchema = z.object({
  duty_date: z.string().min(1, "Duty date is required."),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const securityDutyCompleteSchema = z.object({
  duty_check_id: z.string().uuid(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const supplierMessageSchema = z.object({
  supplier_id: z.string().uuid(),
  message_text: z.string().min(1, "Message is required.").max(2000),
});
