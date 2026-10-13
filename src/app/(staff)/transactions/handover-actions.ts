"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFieldArrangement, PAPERS_STATUS_LABELS, type PapersStatus } from "@/lib/transactions/buy-flow";

// Vehicle papers custody (buying-flow revision, "Papers release"). The Confidential Informant keeps a
// car's papers. At a GCE visit the Sales Manager requests them, the CI hands them over and the Sales
// Manager receives them. At a meet-up or a delivery the assigned CI records the release to himself,
// then hands the papers to the buyer. Nobody else may record the papers.

type HandoverResult = { error: string } | { success: true };
type Admin = ReturnType<typeof createAdminClient>;

const CI_ONLY = "Only the Confidential Informant handles the vehicle papers.";

async function actor(): Promise<{ userId: string; role: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  const role = await getCurrentRole();
  if (!role) return { error: "No role assigned" };
  return { userId: data.user.id, role };
}

// An approved buy request with its arrangement, payments and the papers status so far.
async function loadSale(admin: Admin, transactionId: unknown) {
  const id = z.string().uuid().safeParse(transactionId);
  if (!id.success) return null;
  const { data: tx } = await admin
    .from("transactions")
    .select(
      "id, customer_id, current_state, transaction_kind, purchase_details(arrangement_kind, payment_method), payment_records(verified_by)",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (tx?.transaction_kind !== "buy" || tx.current_state !== "approved") return null;
  const { data: handover } = await admin
    .from("sale_handovers")
    .select("papers_status")
    .eq("transaction_id", tx.id)
    .maybeSingle();
  const details = Array.isArray(tx.purchase_details) ? tx.purchase_details[0] : tx.purchase_details;
  return {
    id: tx.id as string,
    customerId: tx.customer_id as string,
    state: tx.current_state as string,
    field: isFieldArrangement(details ?? null),
    paymentChecked: ((tx.payment_records ?? []) as { verified_by: unknown }[]).some((p) => p.verified_by),
    papers: (handover?.papers_status as PapersStatus | null | undefined) ?? null,
  };
}

type Sale = NonNullable<Awaited<ReturnType<typeof loadSale>>>;

async function setPapers(admin: Admin, sale: Sale, actorId: string, status: PapersStatus, ciId?: string) {
  const { error } = await admin.from("sale_handovers").upsert(
    {
      transaction_id: sale.id,
      papers_status: status,
      papers_updated_at: new Date().toISOString(),
      ...(ciId ? { papers_ci_id: ciId } : {}),
    },
    { onConflict: "transaction_id" },
  );
  if (error) return error.message;
  await admin.from("transaction_status_history").insert({
    transaction_id: sale.id,
    from_state: sale.state,
    to_state: sale.state,
    actor_id: actorId,
    reason: PAPERS_STATUS_LABELS[status],
  });
  revalidatePath(`/dashboard/transactions/${sale.id}`);
  revalidatePath("/dashboard/field-cases");
  revalidatePath(`/my-transactions/${sale.id}`);
  return null;
}

const NOT_FOUND = "Approved purchase request not found.";

// GCE visit: the Sales Manager asks the CI for the papers once the Head Accountant has checked the payment.
export async function requestPapersRelease(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;
  if (!["sales_manager", "ceo"].includes(who.role)) return { error: "Only the Sales Manager requests the papers." };

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  if (sale.field) {
    return { error: "For a meet-up or a delivery, the Confidential Informant releases the papers on the field case." };
  }
  if (!sale.paymentChecked) {
    return { error: "The Head Accountant must check the payment before the papers are requested." };
  }
  if (sale.papers && sale.papers !== "returned") return { error: "The papers were already requested." };

  const error = await setPapers(admin, sale, who.userId, "requested");
  if (error) return { error };
  await notify(
    admin,
    { role: "confidential_informant" },
    {
      kind: "papers_release_requested",
      title: "Vehicle papers requested",
      body: "The Sales Manager asks for a sold car's papers. Approve and hand them over from Field Cases.",
      transactionId: sale.id,
    },
  );
  return { success: true };
}

// GCE visit: the CI approves the request and hands the papers to the Sales Manager.
export async function approvePapersRelease(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;
  if (who.role !== "confidential_informant") return { error: CI_ONLY };

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  if (sale.papers !== "requested") return { error: "No papers release is waiting." };

  const error = await setPapers(admin, sale, who.userId, "handed_over", who.userId);
  if (error) return { error };
  await notify(
    admin,
    { role: "sales_manager" },
    {
      kind: "papers_handed_over",
      title: "Vehicle papers handed over",
      body: "The Confidential Informant approved the release. Record the papers as received, then mark the car sold.",
      transactionId: sale.id,
    },
  );
  return { success: true };
}

// GCE visit: the Sales Manager confirms the papers are in hand. Only then can the car be marked sold.
export async function receivePapers(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;
  if (!["sales_manager", "ceo"].includes(who.role)) return { error: "Only the Sales Manager receives the papers." };

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale || sale.field) return { error: NOT_FOUND };
  if (sale.papers !== "handed_over") return { error: "The Confidential Informant has not handed the papers over yet." };

  const error = await setPapers(admin, sale, who.userId, "received");
  return error ? { error } : { success: true };
}

// The meet-up or delivery of a request, with the Confidential Informant who carries its papers.
async function assignedInformant(admin: Admin, sale: Sale, userId: string): Promise<string | null> {
  if (!sale.field) return "This request has no meet-up or delivery.";
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select("id, assigned_confidential_informant")
    .eq("transaction_id", sale.id)
    .in("case_kind", ["delivery", "buyer_meetup"])
    .neq("state", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!fieldCase) return "The Sales Manager must assign the field case first.";
  if (fieldCase.assigned_confidential_informant !== userId) {
    return "Only the Confidential Informant assigned to this field case can do this.";
  }
  return null;
}

// Meet-up or delivery: before the day, the assigned CI takes the papers out and records it.
export async function releasePapersToCi(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;
  if (who.role !== "confidential_informant") return { error: CI_ONLY };

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  const refusal = await assignedInformant(admin, sale, who.userId);
  if (refusal) return { error: refusal };
  if (sale.papers && sale.papers !== "returned") return { error: "The papers are already released." };

  const error = await setPapers(admin, sale, who.userId, "released_to_ci", who.userId);
  return error ? { error } : { success: true };
}

// Meet-up or delivery: the assigned CI hands the papers to the buyer.
// Phase 3 adds the signed-contract and cash-received checks here.
export async function handPapersToBuyer(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;
  if (who.role !== "confidential_informant") return { error: CI_ONLY };

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  const refusal = await assignedInformant(admin, sale, who.userId);
  if (refusal) return { error: refusal };
  if (sale.papers !== "released_to_ci") return { error: "Record the papers as released first." };

  const error = await setPapers(admin, sale, who.userId, "handed_over", who.userId);
  if (error) return { error };
  await notify(
    admin,
    { role: "sales_manager" },
    {
      kind: "papers_handed_over",
      title: "Vehicle papers handed to the buyer",
      body: "The Confidential Informant handed the papers to the buyer.",
      transactionId: sale.id,
    },
  );
  return { success: true };
}
