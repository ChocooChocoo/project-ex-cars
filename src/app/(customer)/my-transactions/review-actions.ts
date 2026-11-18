"use client";

import { z } from "zod";

import { type ActionResult, apiAction } from "@/lib/api/action";

// Phase 5: Laravel checks the transaction is the customer's and completed, and keeps one review per transaction.
export async function submitReview(formData: FormData) {
  const parsed = z
    .object({
      transaction_id: z.string().uuid(),
      rating: z.coerce.number().int().min(1).max(5),
      body: z.string().trim().min(1, "Write your review.").max(2000, "Keep your review within 2000 characters."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid review." } as ActionResult;
  return apiAction("/trading/review", parsed.data);
}
