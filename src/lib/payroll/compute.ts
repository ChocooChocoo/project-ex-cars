// Hours-based payslip math. Pure, so payroll actions and tests share one source.

export const DAYS_PER_MONTH = 30;
export const OVERTIME_MULTIPLIER = 1.25; // PH Labor Code: overtime is paid at 125% of the hourly rate.
// Used for employees with no work schedule row (Labor Code normal hours).
export const DEFAULT_SCHEDULED_HOURS = 8;

export interface PayslipAttendance {
  attendance_date: string;
  hours_worked: number | null;
}

export interface OvertimeRange {
  start_date: string;
  end_date: string | null;
}

export interface PayslipInput {
  baseSalaryCents: number;
  scheduledHoursPerDay: number;
  entries: PayslipAttendance[];
  overtimeRanges: OvertimeRange[];
}

export interface PayslipComputation {
  hourlyRateCents: number;
  regularHours: number;
  overtimeHours: number;
  shortMinutes: number;
  regularCents: number;
  overtimeCents: number;
  lateCents: number;
}

/** Hours between two Postgres TIME values ("HH:MM:SS"). */
export function scheduledHours(startTime: string, endTime: string): number {
  const minutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  return (minutes(endTime) - minutes(startTime)) / 60;
}

/**
 * Each attended day pays the full schedule; time short of it (late arrival or early leave) comes back as a
 * deduction, so net pay matches the hours worked and lateness is charged once. Hours beyond the schedule are
 * overtime only on days covered by an approved overtime request.
 */
export function computePayslip({
  baseSalaryCents,
  scheduledHoursPerDay,
  entries,
  overtimeRanges,
}: PayslipInput): PayslipComputation {
  const hourlyRateCents = Math.round(baseSalaryCents / DAYS_PER_MONTH / scheduledHoursPerDay);
  const scheduledMinutes = Math.round(scheduledHoursPerDay * 60);
  const isOvertimeDay = (date: string) =>
    overtimeRanges.some((range) => range.start_date <= date && date <= (range.end_date ?? range.start_date));

  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let shortMinutes = 0;
  for (const entry of entries) {
    const workedMinutes = Math.round(Number(entry.hours_worked ?? 0) * 60);
    if (workedMinutes <= 0) continue;
    regularMinutes += scheduledMinutes;
    shortMinutes += Math.max(0, scheduledMinutes - workedMinutes);
    if (isOvertimeDay(entry.attendance_date)) overtimeMinutes += Math.max(0, workedMinutes - scheduledMinutes);
  }

  const regularHours = regularMinutes / 60;
  const overtimeHours = overtimeMinutes / 60;
  return {
    hourlyRateCents,
    regularHours,
    overtimeHours,
    shortMinutes,
    regularCents: Math.round(regularHours * hourlyRateCents),
    overtimeCents: Math.round(overtimeHours * hourlyRateCents * OVERTIME_MULTIPLIER),
    lateCents: Math.round((shortMinutes * hourlyRateCents) / 60),
  };
}
