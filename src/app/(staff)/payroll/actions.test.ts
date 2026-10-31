import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: unknown; error?: { message: string; code?: string } | null };

const employeeId = "11111111-1111-4111-8111-111111111111";
const inserts: { table: string; row: Record<string, unknown> }[] = [];
const updates: { table: string; row: Record<string, unknown> }[] = [];
let attendance: { employee_id: string; attendance_date: string; status: string; hours_worked: number | null }[] = [];
let schedules: { employee_id: string; start_time: string; end_time: string }[] = [];
let overtimeRequests: {
  employee_id: string;
  start_date: string;
  end_date: string | null;
  overtime_hours: number | null;
}[] = [];
let runInsert: Result = { data: { id: "run-1" }, error: null };

const rpc = vi.fn();
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

// Every query in createPayrollRun ends in an awaited chain; a resolved promise with the chain methods attached covers them.
type Chain = Promise<Result> & Record<"select" | "single" | "eq" | "gte" | "lte" | "not", () => Chain>;
function chain(result: Result): Chain {
  const link = () => chain(result);
  return Object.assign(Promise.resolve(result), {
    select: link,
    single: link,
    eq: link,
    gte: link,
    lte: link,
    not: link,
  });
}

function resultFor(table: string, op: "insert" | "update" | "select"): Result {
  if (table === "payroll_runs" && op === "insert") return runInsert;
  if (table === "payslips" && op === "insert") return { data: { id: "slip-1" }, error: null };
  if (table === "attendance_entries") return { data: attendance, error: null };
  if (table === "employee_work_schedules") return { data: schedules, error: null };
  if (table === "employee_requests") return { data: overtimeRequests, error: null };
  return { data: null, error: null };
}

const from = vi.fn((table: string) => ({
  insert: (row: Record<string, unknown>) => {
    inserts.push({ table, row });
    return chain(resultFor(table, "insert"));
  },
  update: (row: Record<string, unknown>) => {
    updates.push({ table, row });
    return chain(resultFor(table, "update"));
  },
  select: () => chain(resultFor(table, "select")),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole: vi.fn(async () => "account_manager") }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    rpc,
    from,
    auth: { getUser: async () => ({ data: { user: { id: "33333333-3333-4333-8333-333333333333" } } }) },
  })),
}));

import { createPayrollRun } from "./actions";

function runForm() {
  const form = new FormData();
  form.set("period_start", "2026-10-01");
  form.set("period_end", "2026-10-15");
  return form;
}

const day = (date: string, status: string, hours_worked: number | null = null) => ({
  employee_id: employeeId,
  attendance_date: date,
  status,
  hours_worked,
});
const items = () => inserts.filter((insert) => insert.table === "payslip_items").map((insert) => insert.row);

describe("createPayrollRun", () => {
  beforeEach(() => {
    inserts.length = 0;
    updates.length = 0;
    runInsert = { data: { id: "run-1" }, error: null };
    schedules = [{ employee_id: employeeId, start_time: "08:00:00", end_time: "18:00:00" }];
    overtimeRequests = [];
    revalidatePath.mockReset();
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: [
        {
          employee_id: employeeId,
          base_salary_cents: 3_000_000, // ₱30,000 a month, 10 h a day = ₱100 an hour
          sss_contribution_cents: 10_000,
          pagibig_contribution_cents: 0,
          philhealth_contribution_cents: 0,
        },
      ],
      error: null,
    });
  });

  it("pays scheduled hours for attended days only, with the right totals", async () => {
    attendance = [day("2026-10-01", "present", 10), day("2026-10-02", "present", 10), day("2026-10-03", "absent")];

    await expect(createPayrollRun(runForm())).resolves.toEqual({ success: true });

    expect(rpc).toHaveBeenCalledWith("list_staff_compensation", {
      p_period_start: "2026-10-01",
      p_period_end: "2026-10-15",
    });
    const payslips = inserts.filter((insert) => insert.table === "payslips");
    expect(payslips).toHaveLength(1);
    expect(payslips[0].row).toMatchObject({
      employee_id: employeeId,
      gross_cents: 200_000,
      deductions_cents: 10_000,
      net_cents: 190_000,
    });
    expect(items()).toContainEqual(
      expect.objectContaining({
        item_kind: "earning",
        label: "Regular hours",
        amount_cents: 200_000,
        source_value: "20.00",
        calculation_note: "20.00 h × ₱100.00/h (base salary / 30 / 10 h a day)",
      }),
    );
    expect(items().map((item) => item.label)).not.toContain("Overtime hours");
    expect(items().map((item) => item.label)).not.toContain("Late / undertime");
    expect(updates.find((update) => update.table === "payroll_runs")?.row).toEqual({
      total_gross_cents: 200_000,
      total_deductions_cents: 10_000,
      total_net_cents: 190_000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/account_manager/payroll");
  });

  it("deducts late and undertime minutes once", async () => {
    attendance = [day("2026-10-01", "late", 9.5), day("2026-10-02", "half_day", 5), day("2026-10-03", "on_leave")];

    await createPayrollRun(runForm());

    expect(items()).toContainEqual(
      expect.objectContaining({
        item_kind: "deduction",
        label: "Late / undertime",
        amount_cents: 55_000,
        source_value: "330",
        calculation_note: "330 min × ₱100.00/h ÷ 60 (late arrival and early leave)",
      }),
    );
    expect(inserts.find((insert) => insert.table === "payslips")?.row).toMatchObject({
      gross_cents: 200_000,
      deductions_cents: 65_000,
      net_cents: 135_000,
    });
  });

  it("pays overtime only on days with an approved overtime request", async () => {
    attendance = [day("2026-10-01", "present", 12), day("2026-10-02", "present", 12)];
    overtimeRequests = [{ employee_id: employeeId, start_date: "2026-10-01", end_date: null, overtime_hours: null }];

    await createPayrollRun(runForm());

    expect(items()).toContainEqual(
      expect.objectContaining({
        item_kind: "earning",
        label: "Overtime hours",
        amount_cents: 25_000,
        source_value: "2.00",
        calculation_note: "2.00 h × ₱100.00/h × 1.25 (approved overtime)",
      }),
    );
    expect(inserts.find((insert) => insert.table === "payslips")?.row).toMatchObject({ gross_cents: 225_000 });
  });

  it("pays no overtime for extra hours without an approved request", async () => {
    attendance = [day("2026-10-01", "present", 12)];

    await createPayrollRun(runForm());

    expect(items().map((item) => item.label)).not.toContain("Overtime hours");
    expect(inserts.find((insert) => insert.table === "payslips")?.row).toMatchObject({ gross_cents: 100_000 });
  });

  it("makes no payslip for an employee with no worked days", async () => {
    attendance = [day("2026-10-01", "absent")];

    await expect(createPayrollRun(runForm())).resolves.toEqual({ success: true });

    expect(inserts.filter((insert) => insert.table === "payslips")).toHaveLength(0);
  });

  it("explains a duplicate period instead of the raw database error", async () => {
    runInsert = {
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "uq_payroll_period"' },
    };

    await expect(createPayrollRun(runForm())).resolves.toEqual({
      error: "A payroll run for this period already exists.",
    });
  });
});
