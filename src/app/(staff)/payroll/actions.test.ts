import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: unknown; error?: { message: string; code?: string } | null };

const employeeId = "11111111-1111-4111-8111-111111111111";
const inserts: { table: string; row: Record<string, unknown> }[] = [];
const updates: { table: string; row: Record<string, unknown> }[] = [];
let attendance: { employee_id: string; attendance_date: string; status: string }[] = [];
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

const day = (date: string, status: string) => ({ employee_id: employeeId, attendance_date: date, status });

describe("createPayrollRun", () => {
  beforeEach(() => {
    inserts.length = 0;
    updates.length = 0;
    runInsert = { data: { id: "run-1" }, error: null };
    revalidatePath.mockReset();
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: [
        {
          employee_id: employeeId,
          base_salary_cents: 3_000_000, // ₱30,000 a month = ₱1,000 a day
          sss_contribution_cents: 10_000,
          pagibig_contribution_cents: 0,
          philhealth_contribution_cents: 0,
        },
      ],
      error: null,
    });
  });

  it("makes one payslip from present days only, with the right totals", async () => {
    attendance = [day("2026-10-01", "present"), day("2026-10-02", "present"), day("2026-10-03", "absent")];

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
    expect(updates.find((update) => update.table === "payroll_runs")?.row).toEqual({
      total_gross_cents: 200_000,
      total_deductions_cents: 10_000,
      total_net_cents: 190_000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/account_manager/payroll");
  });

  it("counts late as a full day, half day as half, and leave as none", async () => {
    attendance = [day("2026-10-01", "late"), day("2026-10-02", "half_day"), day("2026-10-03", "on_leave")];

    await createPayrollRun(runForm());

    expect(inserts.find((insert) => insert.table === "payslips")?.row).toMatchObject({ gross_cents: 150_000 });
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
