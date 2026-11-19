"use client";

import { z } from "zod";

import { apiAction } from "@/lib/api/action";

const markupSchema = z.coerce
  .number({ error: "Enter a percentage." })
  .min(0, "The profit cannot be negative.")
  .max(100, "The profit cannot exceed 100%.");

// T06: the CEO (and the Super Admin) adjust GCE's financing profit. Phase 7: Laravel checks the role, saves the
// value and writes the audit row (AdminController::updateMarkup).
export async function updateFinancingMarkup(value: unknown) {
  const parsed = markupSchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid percentage." };
  return apiAction<{ pct: number }>("/admin/settings/financing-markup", { value: parsed.data });
}
