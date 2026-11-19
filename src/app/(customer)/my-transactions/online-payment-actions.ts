"use client";

// Phase 6: the PayMongo checkout actions call Laravel (backend/app/Http/Controllers/Finance/CheckoutController.php),
// which works out what is due, opens or reuses the Checkout Session and records the unpaid rows. The PayMongo
// webhook (backend/app/Http/Controllers/Finance/PayMongoWebhookController.php) marks them paid.

import { apiAction, laravelForm } from "@/lib/api/action";

export async function startOnlinePayment(formData: FormData) {
  return apiAction<{ url: string }>("/payments/checkout", Object.fromEntries(formData));
}

// T07 CR1: the next unpaid installment, or the ones ticked in Advanced Payment.
export async function startInstallmentCheckout(formData: FormData) {
  return apiAction<{ url: string }>("/payments/installment-checkout", laravelForm(formData));
}
