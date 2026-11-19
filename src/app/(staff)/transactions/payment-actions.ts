"use client";

// Phase 6: recording, verifying and waiving payments run in the browser and call Laravel
// (backend/app/Http/Controllers/Finance/PaymentController.php), which decides every amount from the sale or the
// installment, re-checks the role and locks the rows. Exports, arguments and results are the old Server Actions'.

import { apiAction, laravelForm } from "@/lib/api/action";

export async function recordPayment(formData: FormData) {
  return apiAction("/staff/payments/record", laravelForm(formData));
}

export async function recordAdvancePayment(formData: FormData) {
  return apiAction<{ recorded: number }>("/staff/payments/advance", laravelForm(formData));
}

export async function verifyPayment(paymentId: string) {
  return apiAction("/staff/payments/verify", { payment_id: paymentId });
}

export async function markInstallmentWaived(installmentId: string) {
  return apiAction("/staff/payments/waive-installment", { installment_id: installmentId });
}
