"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { authorizeAction } from "@/lib/auth/action-guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function submitReview(formData: FormData) {
  const authorization = await authorizeAction(["customer"]);
  if (!authorization.ok) return { error: authorization.message };
  const parsed = z
    .object({
      transaction_id: z.string().uuid(),
      rating: z.coerce.number().int().min(1).max(5),
      body: z.string().trim().min(1, "Write your review.").max(2000, "Keep your review within 2000 characters."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  const supabase = await createServerSupabaseClient();
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, customer_id, vehicle_id, current_state")
    .eq("id", parsed.data.transaction_id)
    .maybeSingle();
  if (!tx || tx.customer_id !== authorization.data.userId) return { error: "Transaction not found." };
  if (tx.current_state !== "completed") return { error: "Complete the transaction before reviewing GCE." };
  const { error } = await supabase.from("customer_reviews").insert({
    ...parsed.data,
    customer_id: authorization.data.userId,
    vehicle_id: tx.vehicle_id,
  });
  if (error?.code === "23505") return { error: "You already reviewed this transaction." };
  if (error) return { error: error.message };
  revalidatePath(`/my-transactions/${tx.id}`);
  revalidatePath("/my-transactions");
  revalidatePath("/");
  return { success: true };
}
