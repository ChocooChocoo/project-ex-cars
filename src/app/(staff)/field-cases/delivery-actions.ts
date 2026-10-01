"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  DELIVERY_STATUS_LABELS,
  type DeliveryStatus,
  deliveryBalanceNote,
  nextDeliveryStatus,
  verifiedPaid,
} from "@/lib/transactions/buy-flow";

type DeliveryFieldResult = { error: string } | { success: true };

const DELIVERY_TEAM = ["confidential_informant", "mechanic", "head_security"];

// The delivery team's own case: the caller must be its Informant, Mechanic or Head Security.
async function assignedDelivery(fieldCaseId: unknown) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" } as const;
  const role = await getCurrentRole();
  const id = z.string().uuid().safeParse(fieldCaseId);
  if (!id.success) return { error: "Invalid field case." } as const;

  const admin = createAdminClient();
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select(
      "id, transaction_id, case_kind, state, delivery_status, assigned_confidential_informant, mechanic_id, head_security_id",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (fieldCase?.case_kind !== "delivery" || !fieldCase.transaction_id)
    return { error: "Delivery not found." } as const;
  const assigned = [
    fieldCase.assigned_confidential_informant,
    fieldCase.mechanic_id,
    fieldCase.head_security_id,
  ].includes(data.user.id);
  if (!role || !DELIVERY_TEAM.includes(role) || !assigned) {
    return { error: "Only the assigned delivery team can update this delivery." } as const;
  }
  if (["completed", "cancelled"].includes(fieldCase.state)) return { error: "This delivery is closed." } as const;
  return { admin, role, userId: data.user.id, fieldCase };
}

function done(fieldCaseId: string, transactionId: string): DeliveryFieldResult {
  revalidatePath("/dashboard/field-cases");
  revalidatePath(`/dashboard/field-cases/${fieldCaseId}`);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath(`/my-transactions/${transactionId}`);
  return { success: true };
}

// §4 steps 6–7a: the car leaves only after the Head Accountant confirms the downpayment; then the team
// moves the buyer-visible status Dispatched → In Transit → Arriving → Delivered.
export async function advanceDeliveryStatus(formData: FormData): Promise<DeliveryFieldResult> {
  const context = await assignedDelivery(formData.get("field_case_id"));
  if (context.error !== undefined) return { error: context.error };
  const { admin, fieldCase } = context;
  const next = nextDeliveryStatus(fieldCase.delivery_status as DeliveryStatus | null);
  if (!next) return { error: "The car is already delivered." };

  const { data: tx } = await admin
    .from("transactions")
    .select(
      "id, customer_id, current_state, purchase_details(downpayment_amount, payment_method), payment_records(payment_kind, amount, verified_by)",
    )
    .eq("id", fieldCase.transaction_id)
    .maybeSingle();
  if (tx?.current_state !== "approved") return { error: "This delivery is no longer active." };
  const details = Array.isArray(tx.purchase_details) ? tx.purchase_details[0] : tx.purchase_details;
  if (next === "dispatched") {
    const paid = verifiedPaid(tx.payment_records ?? [], "downpayment");
    if (!details?.downpayment_amount || paid < Number(details.downpayment_amount)) {
      return { error: "Wait for the Head Accountant to confirm the downpayment before dispatch." };
    }
  }

  const { error } = await admin
    .from("field_cases")
    .update({ delivery_status: next, state: next === "delivered" ? "completed" : "in_progress" })
    .eq("id", fieldCase.id);
  if (error) return { error: error.message };
  if (next === "delivered")
    await admin.from("field_cases").update({ completion_date: new Date().toISOString() }).eq("id", fieldCase.id);

  await notify(
    admin,
    { userId: tx.customer_id },
    {
      kind: "delivery_status",
      title: `Delivery: ${DELIVERY_STATUS_LABELS[next]}`,
      body:
        next === "delivered"
          ? `Your car has arrived. Inspect it before you accept it. ${deliveryBalanceNote(details?.payment_method, "buyer")}`
          : `Your delivery is now ${DELIVERY_STATUS_LABELS[next].toLowerCase()}.`,
      transactionId: tx.id,
    },
  );
  if (next === "delivered") {
    await notify(
      admin,
      { role: "sales_manager" },
      {
        kind: "delivery_status",
        title: "Car delivered",
        body: "The delivery team reached the buyer. Record the outcome: balance received, declined or unavailable.",
        transactionId: tx.id,
      },
    );
  }
  return done(fieldCase.id, tx.id);
}

// §4 step 7b: the Confidential Informant reports an expected delay to the Sales Manager.
export async function reportDeliveryDelay(formData: FormData): Promise<DeliveryFieldResult> {
  const context = await assignedDelivery(formData.get("field_case_id"));
  if (context.error !== undefined) return { error: context.error };
  const { admin, role, fieldCase } = context;
  if (role !== "confidential_informant") return { error: "The Confidential Informant reports delays." };

  const parsed = z
    .object({
      delay_note: z.string().trim().min(1, "Describe the delay.").max(500),
      expected_arrival: z.string().optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid delay report." };
  const eta = parsed.data.expected_arrival ? new Date(parsed.data.expected_arrival) : null;
  if (eta && Number.isNaN(eta.getTime())) return { error: "Enter a valid expected arrival time." };

  const { error } = await admin
    .from("field_cases")
    .update({ delay_note: parsed.data.delay_note, expected_arrival: eta?.toISOString() ?? null })
    .eq("id", fieldCase.id);
  if (error) return { error: error.message };

  await notify(
    admin,
    { role: "sales_manager" },
    {
      kind: "delivery_delay_reported",
      title: "Delivery delay reported",
      body: `${parsed.data.delay_note}. Tell the buyer from the transaction page.`,
      transactionId: fieldCase.transaction_id as string,
    },
  );
  return done(fieldCase.id, fieldCase.transaction_id as string);
}
