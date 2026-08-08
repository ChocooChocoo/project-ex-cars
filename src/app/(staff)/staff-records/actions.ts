"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { performanceReviewSchema } from "@/lib/validation/phase6";

type Phase6ActionResult = { error: string } | { success: true };

const REVIEW_MANAGERS = ["ceo", "account_manager"];

export async function submitPerformanceReview(formData: FormData): Promise<Phase6ActionResult> {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const role = await getCurrentRole();
  if (!role || !REVIEW_MANAGERS.includes(role)) {
    return { error: "Not authorized to submit performance reviews" };
  }

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = performanceReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const { error } = await supabase.from("performance_reviews").insert({
    employee_id: parsed.data.employee_id,
    reviewer_id: user.user.id,
    review_period_start: parsed.data.review_period_start,
    review_period_end: parsed.data.review_period_end,
    rating: parsed.data.rating ?? null,
    strengths: parsed.data.strengths || null,
    areas_for_improvement: parsed.data.areas_for_improvement || null,
    goals: parsed.data.goals || null,
    status: "submitted",
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/staff-records");
  return { success: true };
}
