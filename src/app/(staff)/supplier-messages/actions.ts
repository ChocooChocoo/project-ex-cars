"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supplierMessageSchema } from "@/lib/validation/phase6";

type SupplierMessageResult = { error: string } | { success: true };

export async function sendSupplierMessage(formData: FormData): Promise<SupplierMessageResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = supplierMessageSchema.safeParse({
    supplier_id: formData.get("supplier_id"),
    message_text: formData.get("message_text"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const { supplier_id: supplierId, message_text } = parsed.data;

  const { data: roles } = await supabase.rpc("get_user_roles");
  const userRoles = (roles as { role: string }[] | undefined)?.map((r) => r.role) ?? [];
  const isCeo = userRoles.includes("ceo");
  const isSupplier = userRoles.includes("supplier");

  if (!isCeo && !isSupplier) return { error: "Not authorized" };

  const admin = createAdminClient();

  if (isSupplier) {
    const { data: supplier } = await admin
      .from("suppliers")
      .select("id, state")
      .eq("account_id", user.id)
      .maybeSingle();
    if (supplier?.state !== "approved") {
      return { error: "Only approved suppliers can send messages." };
    }
    if (supplier.id !== supplierId) return { error: "Not authorized" };
  }

  const { error } = await admin.from("supplier_messages").insert({
    supplier_id: supplierId,
    sender_id: user.id,
    message_text,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/supplier-messages");
  return { success: true };
}
