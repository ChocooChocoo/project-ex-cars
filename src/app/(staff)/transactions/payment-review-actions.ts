"use client";

// Phase 6: the Sales Manager's approval of an online installment and the Head Accountant's rejection call Laravel
// (backend/app/Http/Controllers/Finance/PaymentController.php). Same exports and results as before.

import { apiAction } from "@/lib/api/action";

// T07 CR1: PayMongo proves the money arrived; the Sales Manager approves it before the Head Accountant verifies.
export async function approveOnlineInstallment(paymentId: string) {
  return apiAction("/staff/payments/approve-online", { payment_id: paymentId });
}

// T03 HA3: a payment waiting for verification is rejected with a reason; it stops counting.
export async function rejectPayment(paymentId: string, reason: string) {
  return apiAction("/staff/payments/reject", { payment_id: paymentId, reason });
}
