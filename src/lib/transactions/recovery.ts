type Installment = { state: unknown; due_date: unknown };

export function consecutiveMissedPayments(rows: Installment[], today = new Date()): number {
  const day = today.toISOString().slice(0, 10);
  let count = 0;
  for (const row of [...rows].sort((a, b) => String(b.due_date).localeCompare(String(a.due_date)))) {
    if (String(row.due_date) >= day) continue;
    if (["paid", "waived"].includes(String(row.state))) break;
    count++;
  }
  return count;
}
