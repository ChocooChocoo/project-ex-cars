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

/**
 * BH-5: what a field budget covers. The checklist replaces free text; the saved `purpose` is the joined labels so
 * the finance screens keep reading the same column. Mirrors FieldBudgetController::EXPENSE_CATEGORIES.
 */
export const FIELD_EXPENSE_CATEGORIES = [
  { value: "fuel", label: "Fuel" },
  { value: "tolls", label: "Tolls" },
  { value: "parking", label: "Parking fee" },
  { value: "meals", label: "Meals" },
  { value: "transport", label: "Transportation fare" },
  { value: "other", label: "Other" },
] as const;

export type FieldExpenseCategory = (typeof FIELD_EXPENSE_CATEGORIES)[number]["value"];

const CATEGORY_LABELS = new Map<string, string>(FIELD_EXPENSE_CATEGORIES.map(({ value, label }) => [value, label]));

/** The one-line purpose stored on a disbursement request, in checklist order ("Fuel, Tolls, Other: car wash"). */
export function fieldExpensePurpose(categories: readonly string[], other = ""): string {
  const picked = new Set(categories);
  const labels: string[] = [];
  for (const { value, label } of FIELD_EXPENSE_CATEGORIES) {
    if (!picked.has(value)) continue;
    labels.push(value === "other" && other.trim() !== "" ? `Other: ${other.trim()}` : label);
  }
  return labels.join(", ");
}

/** The same label the server stores for one category, for a category that is not ticked. */
export function fieldExpenseCategoryLabel(value: unknown): string {
  return CATEGORY_LABELS.get(String(value)) ?? String(value ?? "");
}

/** A budget with nothing left over is closed on the spot: no "Confirm excess received" task for the Head Accountant. */
export function budgetNoExcess(releasedCents: number, expenses: readonly Expense[]): boolean {
  return releasedCents > 0 && budgetExcessCents(releasedCents, expenses) === 0;
}
