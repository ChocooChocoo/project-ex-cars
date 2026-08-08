// Pure installment schedule generator (R-19, R-37).
// No I/O, no server imports.

import { addMonths, addWeeks } from "date-fns";

export type PaymentFrequency = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface InstallmentScheduleInput {
  totalAmount: number;
  downPayment: number;
  numberOfPayments: number;
  firstDueDate: Date;
  frequency: PaymentFrequency;
}

export interface ScheduledInstallment {
  sequenceNo: number;
  dueDate: string; // ISO date string
  amountDue: number;
}

function advanceDate(date: Date, frequency: PaymentFrequency): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(date, 1);
    case "biweekly":
      return addWeeks(date, 2);
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addMonths(date, 3);
  }
}

export function generateInstallmentSchedule(input: InstallmentScheduleInput): ScheduledInstallment[] {
  if (input.numberOfPayments < 1) {
    throw new Error("numberOfPayments must be at least 1");
  }
  if (input.totalAmount < 0 || input.downPayment < 0) {
    throw new Error("amounts must be non-negative");
  }

  const financed = input.totalAmount - input.downPayment;
  const baseAmount = Math.floor((financed / input.numberOfPayments) * 100) / 100;
  // Last installment absorbs rounding remainder so total adds up exactly.
  const remainder = Math.round((financed - baseAmount * input.numberOfPayments) * 100) / 100;

  const schedule: ScheduledInstallment[] = [];
  let dueDate = input.firstDueDate;

  for (let i = 0; i < input.numberOfPayments; i++) {
    const isLast = i === input.numberOfPayments - 1;
    schedule.push({
      sequenceNo: i + 1,
      dueDate: dueDate.toISOString().slice(0, 10),
      amountDue: isLast ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount,
    });
    if (!isLast) {
      dueDate = advanceDate(dueDate, input.frequency);
    }
  }

  return schedule;
}

/** Returns true when an installment should be considered overdue. */
export function isDue(state: string, dueDate: string): boolean {
  if (state === "paid" || state === "waived") return false;
  const now = new Date();
  const due = new Date(dueDate);
  // Use start-of-day comparison: due if today >= due date and not yet paid.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueDay <= today;
}

/** Derive the correct installment state from the current DB state and due date. */
export function deriveInstallmentState(currentState: string, dueDate: string): string {
  if (currentState === "paid" || currentState === "waived") return currentState;
  return isDue(currentState, dueDate) ? "overdue" : "upcoming";
}
