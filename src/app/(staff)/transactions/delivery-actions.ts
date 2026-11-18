"use client";

// Phase 5: the Sales Manager's delivery and meet-up steps call Laravel
// (backend/app/Http/Controllers/Trading/DeliveryController.php). Same exports and results as before.

import { apiAction } from "@/lib/api/action";

type DeliveryActionResult = { error: string } | { success: true };

const send = (path: string, formData: FormData) =>
  apiAction(`/staff/trading/${path}`, Object.fromEntries(formData)) as Promise<DeliveryActionResult>;

export async function setDeliveryTerms(formData: FormData): Promise<DeliveryActionResult> {
  return send("delivery-terms", formData);
}

export async function createDeliveryFieldCase(formData: FormData): Promise<DeliveryActionResult> {
  return send("delivery-case", formData);
}

export async function createMeetupFieldCase(formData: FormData): Promise<DeliveryActionResult> {
  return send("meetup-case", formData);
}

export async function relayDeliveryDelay(formData: FormData): Promise<DeliveryActionResult> {
  return send("delivery-delay", formData);
}

export async function cancelUnpaidDelivery(formData: FormData): Promise<DeliveryActionResult> {
  return send("cancel-unpaid-delivery", formData);
}
