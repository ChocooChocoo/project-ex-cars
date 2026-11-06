// T06: payment reminders 7, 3 and 1 day before each installment is due, in Philippine time.

export const REMINDER_DAYS = [7, 3, 1] as const;
export type ReminderDays = (typeof REMINDER_DAYS)[number];

const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" in Manila, `days` after `now`. */
export function manilaDay(now: Date, days = 0): string {
  return manilaDate.format(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
}

/** The due dates that get a reminder today, keyed by how many days ahead they are. */
export function reminderDueDates(now: Date): Map<string, ReminderDays> {
  return new Map(REMINDER_DAYS.map((days) => [manilaDay(now, days), days]));
}

export function reminderMessage(input: {
  name: string | null;
  amount: number;
  dueDate: string;
  days: ReminderDays;
  car: string;
}) {
  const pesos = input.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const when = input.days === 1 ? "tomorrow" : `in ${input.days} days`;
  return {
    subject: `GCE payment reminder: ₱${pesos} due ${when}`,
    text: [
      `Hi ${input.name ?? "there"},`,
      "",
      `Your In-House Financing installment of ₱${pesos} for ${input.car} is due ${when}, on ${input.dueDate}.`,
      "Open My Transactions in the GCE app. Use Payment for your next installment or Advanced Payment to select future installments. Submit your cash payment or bank-transfer proof for Head Accountant verification.",
      "",
      "If you have already paid, you can ignore this email.",
      "",
      "Global Exchange Car",
    ].join("\n"),
  };
}
