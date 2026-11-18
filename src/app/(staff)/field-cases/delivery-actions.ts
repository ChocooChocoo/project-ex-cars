"use client";

// Phase 5: the delivery team's steps call Laravel (backend/app/Http/Controllers/Field/FieldCaseActionController.php).

import { apiAction } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

type DeliveryFieldResult = { error: string } | { success: true };

const send = (path: string, formData: FormData) =>
  apiAction(`/staff/field/${path}`, Object.fromEntries(formData)) as Promise<DeliveryFieldResult>;

export async function advanceDeliveryStatus(formData: FormData): Promise<DeliveryFieldResult> {
  return send("advance-delivery-status", formData);
}

export async function reportDeliveryDelay(formData: FormData): Promise<DeliveryFieldResult> {
  return send("report-delivery-delay", formData);
}

export async function receiveFieldCase(formData: FormData): Promise<DeliveryFieldResult> {
  return send("receive-field-case", formData);
}

// Sent at most once a minute while the car is on the road; no page reload, the viewers poll on their own.
export async function updateDeliveryLocation(
  fieldCaseId: string,
  lat: number,
  lng: number,
): Promise<DeliveryFieldResult> {
  try {
    await browserApi("POST", "/api/v1/staff/field/update-delivery-location", { field_case_id: fieldCaseId, lat, lng });
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
