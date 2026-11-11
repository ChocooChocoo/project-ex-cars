import { FINANCING_TERM_MONTHS, financedTotal } from "@/lib/transactions/buy-flow";
import { downPaymentFor } from "@/lib/transactions/delivery-fee";

// T06: GCE's loan calculator, modelled on Motortrade's. The buyer enters an estimated monthly income; the vehicle comes from the
// price; it shows the monthly payment for every term GCE offers and whether the income likely fits.

/** Share of monthly income a car payment may take before the term counts as a stretch. */
export const AFFORDABLE_INCOME_SHARE = 0.3;

/** The even monthly installment on what is left after the downpayment, rounded up to the peso. */
export function monthlyInstallment(totalAmount: number, downPayment: number, months: number): number {
  return Math.ceil(Math.max(0, totalAmount - downPayment) / months);
}

export type LoanInput = {
  price: number;
  markupPct: number;
  monthlyIncome: number;
};

export type LoanTerm = { months: number; monthly: number; eligible: boolean };

export function computeLoan({ price, markupPct, monthlyIncome }: LoanInput) {
  const total = financedTotal(price, markupPct);
  const downPayment = downPaymentFor(price);
  const maxMonthly = monthlyIncome * AFFORDABLE_INCOME_SHARE;
  const terms: LoanTerm[] = FINANCING_TERM_MONTHS.map((months) => {
    const monthly = monthlyInstallment(total, downPayment, months);
    return { months, monthly, eligible: monthlyIncome > 0 && monthly <= maxMonthly };
  });
  return {
    total,
    downPayment,
    financed: total - downPayment,
    maxMonthly,
    terms,
  };
}
