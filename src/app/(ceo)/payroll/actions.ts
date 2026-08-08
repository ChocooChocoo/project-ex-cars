"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { payrollApprovalSchema, payrollRunSchema, payslipItemSchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const PAYROLL_PREPARERS = ["ceo", "account_manager"];
const PAYROLL_REVIEWERS = ["ceo", "head_accountant"];
const WORKING_DAYS_PER_MONTH = 30;

export async function createPayrollRun(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !PAYROLL_PREPARERS.includes(role)) {
    return { error: "Not authorized to prepare payroll" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = payrollRunSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payroll run." };
  }

  const admin = createAdminClient();

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .insert({
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
      status: "draft",
      prepared_by: user.user.id,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();
  if (runError) return { error: runError.message };

  // Only checked attendance feeds payroll input.
  const { data: attendance } = await supabase
    .from("attendance_entries")
    .select("employee_id, attendance_date, status")
    .gte("attendance_date", parsed.data.period_start)
    .lte("attendance_date", parsed.data.period_end)
    .not("checked_by", "is", null);

  const { data: compensation } = await admin
    .from("staff_compensation")
    .select("employee_id, base_salary_cents, effective_from, effective_until")
    .lte("effective_from", parsed.data.period_end)
    .or(`effective_until.is.null,effective_until.gte.${parsed.data.period_start}`);

  const workedDaysByEmployee = new Map<string, number>();
  for (const entry of attendance ?? []) {
    const employeeId = entry.employee_id as string;
    const worked = entry.status === "half_day" ? 0.5 : 1;
    workedDaysByEmployee.set(employeeId, (workedDaysByEmployee.get(employeeId) ?? 0) + worked);
  }

  const dailyRateByEmployee = new Map<string, number>();
  for (const comp of compensation ?? []) {
    dailyRateByEmployee.set(
      comp.employee_id as string,
      Math.round((comp.base_salary_cents as number) / WORKING_DAYS_PER_MONTH),
    );
  }

  let totalGross = 0;

  for (const [employeeId, workedDays] of workedDaysByEmployee) {
    const dailyRate = dailyRateByEmployee.get(employeeId);
    if (!dailyRate) continue;

    const gross = Math.round(dailyRate * workedDays);
    totalGross += gross;

    const { data: payslip, error: payslipError } = await supabase
      .from("payslips")
      .insert({
        payroll_run_id: run.id,
        employee_id: employeeId,
        gross_cents: gross,
        deductions_cents: 0,
        net_cents: gross,
        status: "draft",
      })
      .select()
      .single();
    if (payslipError) return { error: payslipError.message };

    await supabase.from("payslip_items").insert({
      payslip_id: payslip.id,
      item_kind: "earning",
      label: "Base salary",
      amount_cents: gross,
      source_value: String(workedDays),
      calculation_note: `${workedDays} checked attendance day(s) × daily rate ₱${(dailyRate / 100).toFixed(2)} (base salary / 30)`,
    });
  }

  const { error: totalError } = await supabase
    .from("payroll_runs")
    .update({ total_gross_cents: totalGross, total_net_cents: totalGross })
    .eq("id", run.id);
  if (totalError) return { error: totalError.message };

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/payslips");
  return { success: true };
}

export async function reviewPayrollRun(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !PAYROLL_REVIEWERS.includes(role)) {
    return { error: "Not authorized to review payroll" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = payrollApprovalSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const { data: run } = await supabase
    .from("payroll_runs")
    .select("status")
    .eq("id", parsed.data.payroll_run_id)
    .single();
  if (!run) return { error: "Payroll run not found." };

  if (parsed.data.decision === "rejected") {
    if (run.status !== "pending_approval") {
      return { error: "Only pending runs can be rejected." };
    }
    const { error: updateError } = await supabase
      .from("payroll_runs")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", parsed.data.payroll_run_id);
    if (updateError) return { error: updateError.message };

    await supabase.from("payroll_approvals").insert({
      payroll_run_id: parsed.data.payroll_run_id,
      sequence: role === "head_accountant" ? 1 : 2,
      reviewer_id: user.user.id,
      decision: "rejected",
      notes: parsed.data.notes || null,
    });

    revalidatePath("/dashboard/payroll");
    return { success: true };
  }

  if (run.status !== "draft" && run.status !== "pending_approval") {
    return { error: "Only draft or pending runs can be approved." };
  }

  const { data: approvals } = await supabase
    .from("payroll_approvals")
    .select("sequence")
    .eq("payroll_run_id", parsed.data.payroll_run_id);

  const approvedSequences = new Set((approvals ?? []).map((approval) => approval.sequence as number));

  // Provisional Q-13: Head Accountant reviews first (sequence 1), CEO second (sequence 2).
  const requiredSequence = role === "head_accountant" ? 1 : 2;

  if (requiredSequence === 2 && !approvedSequences.has(1)) {
    return { error: "The Head Accountant must approve the run before the CEO." };
  }
  if (approvedSequences.has(requiredSequence)) {
    return { error: "This step has already been approved." };
  }

  const nextStatus = requiredSequence === 2 ? "approved" : "pending_approval";

  const { error: updateError } = await supabase
    .from("payroll_runs")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.payroll_run_id);
  if (updateError) return { error: updateError.message };

  await supabase.from("payroll_approvals").insert({
    payroll_run_id: parsed.data.payroll_run_id,
    sequence: requiredSequence,
    reviewer_id: user.user.id,
    decision: "approved",
    notes: parsed.data.notes || null,
  });

  revalidatePath("/dashboard/payroll");
  return { success: true };
}

export async function finalizePayrollRun(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || role !== "head_accountant") {
    return { error: "Only the Head Accountant can finalize payroll" };
  }

  const runId = formData.get("payroll_run_id") as string;

  const { data: run } = await supabase.from("payroll_runs").select("status").eq("id", runId).single();
  if (!run) return { error: "Payroll run not found." };
  if (run.status !== "approved") return { error: "Only approved runs can be finalized." };

  const { error: runError } = await supabase
    .from("payroll_runs")
    .update({ status: "finalized", updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (runError) return { error: runError.message };

  const { error: payslipError } = await supabase
    .from("payslips")
    .update({ status: "finalized", finalized_at: new Date().toISOString() })
    .eq("payroll_run_id", runId)
    .eq("status", "draft");
  if (payslipError) return { error: payslipError.message };

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/payslips");
  return { success: true };
}

export async function addPayslipItem(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !PAYROLL_PREPARERS.includes(role)) {
    return { error: "Not authorized to edit payslips" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = payslipItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payslip item." };
  }

  const { data: payslip } = await supabase.from("payslips").select("status").eq("id", parsed.data.payslip_id).single();
  if (!payslip) return { error: "Payslip not found." };
  if (payslip.status !== "draft") return { error: "Finalized payslips cannot be edited." };

  const { error: itemError } = await supabase.from("payslip_items").insert({
    payslip_id: parsed.data.payslip_id,
    item_kind: parsed.data.item_kind,
    label: parsed.data.label,
    amount_cents: parsed.data.amount_cents,
    source_value: parsed.data.source_value || null,
    calculation_note: parsed.data.calculation_note || null,
  });
  if (itemError) return { error: itemError.message };

  const { data: items } = await supabase
    .from("payslip_items")
    .select("item_kind, amount_cents")
    .eq("payslip_id", parsed.data.payslip_id);

  let gross = 0;
  let deductions = 0;
  for (const item of items ?? []) {
    if (item.item_kind === "earning") gross += item.amount_cents;
    else deductions += item.amount_cents;
  }
  const net = Math.max(0, gross - deductions);

  const { error: payslipError } = await supabase
    .from("payslips")
    .update({ gross_cents: gross, deductions_cents: deductions, net_cents: net })
    .eq("id", parsed.data.payslip_id);
  if (payslipError) return { error: payslipError.message };

  revalidatePath("/dashboard/payslips");
  return { success: true };
}
