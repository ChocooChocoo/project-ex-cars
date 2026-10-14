"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isDirectPayment,
  isFieldArrangement,
  missingContractCopies,
  PAPERS_STATUS_LABELS,
  type PapersStatus,
  signsInApp,
} from "@/lib/transactions/buy-flow";

// Vehicle papers custody (buying-flow revision, "Papers release"). The Confidential Informant keeps a
// car's papers. At a GCE visit the Sales Manager requests them, the CI hands them over and the Sales
// Manager receives them. At a meet-up or a delivery the assigned CI records the release to himself,
// then hands the papers to the buyer. Nobody else may record the papers.
// The contract lives on the same row: written, approved, signed and kept before the papers move on.

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
  const { data: handover } = await admin.from("sale_handovers").select("*").eq("transaction_id", tx.id).maybeSingle();
  const details = (Array.isArray(tx.purchase_details) ? tx.purchase_details[0] : tx.purchase_details) ?? null;
  return {
    id: tx.id as string,
    customerId: tx.customer_id as string,
    state: tx.current_state as string,
    details: details as { arrangement_kind?: unknown; payment_method?: unknown } | null,
    field: isFieldArrangement(details),
    paymentChecked: ((tx.payment_records ?? []) as { verified_by: unknown }[]).some((p) => p.verified_by),
    papers: (handover?.papers_status as PapersStatus | null | undefined) ?? null,
    handover: (handover ?? {}) as Record<string, unknown>,
  };
}

type Sale = NonNullable<Awaited<ReturnType<typeof loadSale>>>;

// One write to the request's handover row, with a line in its history.
async function setHandover(
  admin: Admin,
  sale: Sale,
  actorId: string,
  patch: Record<string, unknown>,
  historyReason: string,
) {
  const { error } = await admin
    .from("sale_handovers")
    .upsert({ transaction_id: sale.id, ...patch }, { onConflict: "transaction_id" });
  if (error) return error.message;
  await admin.from("transaction_status_history").insert({
    transaction_id: sale.id,
    from_state: sale.state,
    to_state: sale.state,
    actor_id: actorId,
    reason: historyReason,
  });
  revalidatePath(`/dashboard/transactions/${sale.id}`);
  revalidatePath("/dashboard/field-cases");
  revalidatePath(`/my-transactions/${sale.id}`);
  return null;
}

function setPapers(admin: Admin, sale: Sale, actorId: string, status: PapersStatus, ciId?: string) {
  return setHandover(
    admin,
    sale,
    actorId,
    { papers_status: status, papers_updated_at: new Date().toISOString(), ...(ciId ? { papers_ci_id: ciId } : {}) },
    PAPERS_STATUS_LABELS[status],
  );
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

// The meet-up or delivery of a request, with the Confidential Informant who carries its papers and the
// Mechanic who goes with him.
async function fieldTeam(
  admin: Admin,
  sale: Sale,
): Promise<{ informant: string | null; mechanic: string | null } | { error: string }> {
  if (!sale.field) return { error: "This request has no meet-up or delivery." };
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select("id, assigned_confidential_informant, mechanic_id")
    .eq("transaction_id", sale.id)
    .in("case_kind", ["delivery", "buyer_meetup"])
    .neq("state", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!fieldCase) return { error: "The Sales Manager must assign the field case first." };
  return {
    informant: fieldCase.assigned_confidential_informant as string | null,
    mechanic: fieldCase.mechanic_id as string | null,
  };
}

async function assignedInformant(admin: Admin, sale: Sale, userId: string): Promise<string | null> {
  const team = await fieldTeam(admin, sale);
  if ("error" in team) return team.error;
  return team.informant === userId ? null : "Only the Confidential Informant assigned to this field case can do this.";
}

// The assigned Confidential Informant or Mechanic, whichever the user is.
async function assignedMember(
  admin: Admin,
  sale: Sale,
  who: { userId: string; role: string },
): Promise<"informant" | "mechanic" | { error: string }> {
  const team = await fieldTeam(admin, sale);
  if ("error" in team) return team;
  if (who.role === "confidential_informant" && team.informant === who.userId) return "informant";
  if (who.role === "mechanic" && team.mechanic === who.userId) return "mechanic";
  return { error: "Only the team assigned to this field case can do this." };
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

// Meet-up or delivery: the assigned CI hands the papers to the buyer, after the contract is signed and,
// where the buyer pays in cash or by bank transfer, after the money is reported.
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
  if (sale.handover.contract_state !== "signed") {
    return { error: "The buyer must sign the contract before the papers are handed over." };
  }
  if (isDirectPayment(sale.details) && !sale.handover.cash_reported_at) {
    return { error: "Report the cash received before the papers are handed over." };
  }

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

// Financing at a GCE visit or a meet-up: the Sales Manager writes the contract (typed, or started from
// the template) and sends it to the Head Accountant.
export async function saveContract(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;
  if (!["sales_manager", "ceo"].includes(who.role)) return { error: "Only the Sales Manager writes the contract." };

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  if (!signsInApp(sale.details)) {
    return { error: "This contract is signed on paper at the meet-up or on delivery." };
  }
  if (!["draft", "returned"].includes(String(sale.handover.contract_state ?? "draft"))) {
    return { error: "The contract can no longer be changed." };
  }
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write the contract first." };

  const submit = formData.get("submit") === "1";
  const error = await setHandover(
    admin,
    sale,
    who.userId,
    {
      contract_body: body,
      contract_state: submit ? "pending_approval" : "draft",
      contract_written_by: who.userId,
      contract_returned_reason: null,
    },
    submit ? "Contract sent for approval" : "Contract draft saved",
  );
  if (error) return { error };
  if (submit) {
    await notify(
      admin,
      { role: "head_accountant" },
      {
        kind: "contract_pending_approval",
        title: "Contract waiting for approval",
        body: "The Sales Manager wrote a contract. Read it on the request, then approve it or return it.",
        transactionId: sale.id,
      },
    );
  }
  return { success: true };
}

// The Head Accountant approves the contract, or returns it to the Sales Manager with a reason.
export async function reviewContract(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;
  if (who.role !== "head_accountant") return { error: "Only the Head Accountant reviews the contract." };

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  if (sale.handover.contract_state !== "pending_approval") return { error: "No contract is waiting for approval." };

  if (formData.get("decision") === "approve") {
    const error = await setHandover(
      admin,
      sale,
      who.userId,
      { contract_state: "approved", contract_approved_by: who.userId },
      "Contract approved",
    );
    if (error) return { error };
    await notify(
      admin,
      { userId: sale.customerId },
      {
        kind: "contract_approved",
        title: "Your contract is ready to sign",
        body: "Read the contract on your request and sign it.",
        transactionId: sale.id,
      },
    );
    return { success: true };
  }

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give the reason for returning the contract." };
  const error = await setHandover(
    admin,
    sale,
    who.userId,
    { contract_state: "returned", contract_returned_reason: reason },
    `Contract returned for revision: ${reason}`,
  );
  if (error) return { error };
  await notify(
    admin,
    { role: "sales_manager" },
    {
      kind: "contract_returned",
      title: "Contract returned for revision",
      body: `The Head Accountant returned the contract. Reason: ${reason}`,
      transactionId: sale.id,
    },
  );
  return { success: true };
}

// Meet-up or delivery: the team tells GCE the buyer has been met.
export async function recordBuyerMet(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  const member = await assignedMember(admin, sale, who);
  if (typeof member !== "string") return member;

  const error = await setHandover(admin, sale, who.userId, { buyer_met_at: new Date().toISOString() }, "Buyer Met");
  return error ? { error } : { success: true };
}

// Meet-up or delivery: the assigned CI reports that the buyer signed. A contract signed on paper becomes
// signed here; one signed in the app must already carry the buyer's signature.
export async function reportSigning(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;
  if (who.role !== "confidential_informant") {
    return { error: "Only the assigned Confidential Informant reports the signing." };
  }

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  const refusal = await assignedInformant(admin, sale, who.userId);
  if (refusal) return { error: refusal };
  if (!sale.handover.buyer_met_at) return { error: "Record Buyer Met first." };

  const signed = sale.handover.contract_state === "signed";
  if (signsInApp(sale.details) && !signed) return { error: "The buyer has not signed the contract in the app yet." };

  const now = new Date().toISOString();
  const error = await setHandover(
    admin,
    sale,
    who.userId,
    { signing_reported_at: now, ...(signed ? {} : { contract_state: "signed", contract_signed_at: now }) },
    "Contract Signed (reported by CI)",
  );
  if (error) return { error };
  for (const role of ["sales_manager", "head_accountant"]) {
    await notify(
      admin,
      { role },
      {
        kind: "contract_signing_reported",
        title: "Contract signed",
        body: "The buyer has signed the contract.",
        transactionId: sale.id,
      },
    );
  }
  return { success: true };
}

// Meet-up or delivery: the CI, and at a cash Meet Halfway the Mechanic, record that they hold a signed copy.
export async function recordContractCopy(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  const member = await assignedMember(admin, sale, who);
  if (typeof member !== "string") return member;
  if (sale.handover.contract_state !== "signed") return { error: "The contract is not signed yet." };

  const column = member === "informant" ? "ci_copy_at" : "mechanic_copy_at";
  const holder = member === "informant" ? "Confidential Informant" : "Mechanic";
  const now = new Date().toISOString();
  const error = await setHandover(admin, sale, who.userId, { [column]: now }, `Signed contract kept by the ${holder}`);
  if (error) return { error };

  const missing = missingContractCopies(sale.details, { ...sale.handover, [column]: now });
  if (missing.length > 0) {
    await notify(
      admin,
      { role: "sales_manager" },
      {
        kind: "contract_copy_missing",
        title: "Signed contract not fully kept",
        body: `The ${holder} recorded a signed copy. Still missing: ${missing.join(" and ")}.`,
        transactionId: sale.id,
      },
    );
  }
  return { success: true };
}

// Meet-up or delivery paid in cash or by bank transfer: the team reports the money to the Sales Manager.
export async function reportCashReceived(formData: FormData): Promise<HandoverResult> {
  const who = await actor();
  if ("error" in who) return who;

  const admin = createAdminClient();
  const sale = await loadSale(admin, formData.get("transaction_id"));
  if (!sale) return { error: NOT_FOUND };
  const member = await assignedMember(admin, sale, who);
  if (typeof member !== "string") return member;
  if (!isDirectPayment(sale.details)) return { error: "Nothing is collected in the field on a financed sale." };
  if (sale.handover.contract_state !== "signed") {
    return { error: "The buyer must sign the contract before the cash is reported." };
  }

  const error = await setHandover(
    admin,
    sale,
    who.userId,
    { cash_reported_at: new Date().toISOString() },
    "Cash received in the field",
  );
  if (error) return { error };
  await notify(
    admin,
    { role: "sales_manager" },
    {
      kind: "cash_reported",
      title: "Cash received from the buyer",
      body: "The field team received the buyer's payment. Record it on the request.",
      transactionId: sale.id,
    },
  );
  return { success: true };
}
