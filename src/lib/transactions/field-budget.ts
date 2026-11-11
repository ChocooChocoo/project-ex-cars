// T10: a field budget is released cash; what the receipts do not cover goes back to the Head Accountant.

type Expense = { amount?: unknown };

/** Expenses logged on the case, in centavos. */
export function expensesCents(expenses: readonly Expense[]): number {
  return expenses.reduce((sum, expense) => sum + Math.round(Number(expense.amount ?? 0) * 100), 0);
}

/** What the Confidential Informant should return: the released amount less the logged expenses, never below 0. */
export function budgetExcessCents(releasedCents: number, expenses: readonly Expense[]): number {
  return Math.max(0, releasedCents - expensesCents(expenses));
}

/** A budget the Head Accountant has released (cash in the Confidential Informant's hands). */
export function budgetReleased(status: unknown): boolean {
  return ["released", "received", "paid"].includes(String(status));
}
