"use client";

import { z } from "zod";

import { apiAction } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import {
  compensationSchema,
  payrollApprovalSchema,
  payrollRunSchema,
  payslipItemSchema,
} from "@/lib/validation/phase6";

// Phase 7: browser adapters for the Laravel payroll endpoints (PayrollController). Laravel computes the payslips
// (App\Services\Payroll\PayslipCalculator, same math as src/lib/payroll/compute.ts) and checks every role.

type Phase6ActionResult = { error: string } | { success: true };

async function done(path: string, body: unknown): Promise<Phase6ActionResult> {
  const result = await apiAction(path, body);
  return result.error !== undefined ? { error: result.error } : { success: true };
}

function parsed<T>(schema: z.ZodType<T>, formData: FormData, fallback: string): { data: T } | { error: string } {
  const result = schema.safeParse(Object.fromEntries(formData));
  return result.success ? { data: result.data } : { error: result.error.issues[0]?.message ?? fallback };
}

export async function saveCompensation(formData: FormData): Promise<Phase6ActionResult> {
  const input = parsed(compensationSchema, formData, "Invalid compensation.");
  if ("error" in input) return input;
  return done("/staff/payroll/compensation", {
    ...input.data,
    effective_until: input.data.effective_until || null,
    tin_number: input.data.tin_number || null,
  });
}

export async function markPayslipPaid(formData: FormData): Promise<Phase6ActionResult> {
  return done("/staff/payroll/payslips/mark-paid", { payslip_id: formData.get("payslip_id") });
}

export async function createPayrollRun(formData: FormData): Promise<Phase6ActionResult> {
  const input = parsed(payrollRunSchema, formData, "Invalid payroll run.");
  if ("error" in input) return input;
  return done("/staff/payroll/runs", input.data);
}

export async function reviewPayrollRun(formData: FormData): Promise<Phase6ActionResult> {
  const input = parsed(payrollApprovalSchema, formData, "Invalid review.");
  if ("error" in input) return input;
  return done("/staff/payroll/runs/review", input.data);
}

export async function finalizePayrollRun(formData: FormData): Promise<Phase6ActionResult> {
  return done("/staff/payroll/runs/finalize", { payroll_run_id: formData.get("payroll_run_id") });
}

export async function addPayslipItem(formData: FormData): Promise<Phase6ActionResult> {
  const input = parsed(payslipItemSchema, formData, "Invalid payslip item.");
  if ("error" in input) return input;
  return done("/staff/payroll/payslip-items", input.data);
}

// Phase 6 T07: the payroll row opens this detail before any approval action.
export async function getPayrollRunDetail(runId: string) {
  if (!z.string().uuid().safeParse(runId).success) return { error: "Invalid payroll run." };
  try {
    const { run } = await browserApi<{ run: Record<string, unknown> }>("GET", `/api/v1/staff/payroll/runs/${runId}`);
    return { success: true as const, run };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
