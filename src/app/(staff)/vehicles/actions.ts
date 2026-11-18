"use client";

// Phase 5: staff vehicle writes call Laravel (backend/app/Http/Controllers/Trading/VehicleWriteController.php):
// inventory, price proposals, the CEO's price and ceiling decisions, inspections. The zod checks run here first
// so the messages stay the same; Laravel checks again.

import { type ActionResult, apiAction } from "@/lib/api/action";
import { checklistAnswerSchema, inspectionSchema, priceProposalSchema, vehicleSchema } from "@/lib/validation/vehicles";

export async function createVehicle(formData: FormData) {
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details." } as ActionResult<{ id: string }>;
  return apiAction<{ id: string }>("/staff/vehicles", Object.fromEntries(formData));
}

export async function updateVehicle(formData: FormData) {
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details." } as ActionResult;
  return apiAction("/staff/vehicles/update", Object.fromEntries(formData));
}

export async function publishVehicle(formData: FormData) {
  return apiAction("/staff/vehicles/publish", Object.fromEntries(formData));
}

export async function proposePrice(formData: FormData) {
  const parsed = priceProposalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid price proposal." } as ActionResult;
  return apiAction("/staff/vehicles/propose-price", Object.fromEntries(formData));
}

export async function approvePrice(formData: FormData) {
  return apiAction("/staff/vehicles/approve-price", Object.fromEntries(formData));
}

export async function createInspection(formData: FormData) {
  const parsed = inspectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid inspection details." } as ActionResult<{ id: string }>;
  return apiAction<{ id: string }>("/staff/inspections", Object.fromEntries(formData));
}

export async function submitChecklistAnswer(formData: FormData) {
  const parsed = checklistAnswerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid checklist answer." } as ActionResult;
  return apiAction("/staff/inspections/answer", Object.fromEntries(formData));
}

export async function archiveVehicle(vehicleId: string) {
  return apiAction(`/staff/vehicles/${encodeURIComponent(vehicleId)}/archive`);
}
