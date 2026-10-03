"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { ACCEPTED_ID_TYPES } from "@/lib/auth/roles";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  activeBuyerIdCount,
  BUYER_ID_COUNT,
  isFinancingRequest,
  isOnsiteCashRequest,
  isQueuedRequest,
  isVisitSlot,
} from "@/lib/transactions/buy-flow";
import { releaseVisitSlots } from "@/lib/transactions/buy-flow-server";
import { DOCUMENT_EXTENSIONS, MAX_DOCUMENT_SIZE } from "@/lib/transactions/document-media";
import { canCancelScheduled, nextQueueState, reviewDueAt } from "@/lib/transactions/state-machine";
import {
  buyDetailsSchema,
  buyTransactionSchema,
  requestCarSchema,
  sellVehicleSchema,
} from "@/lib/validation/transactions";

import { randomUUID } from "node:crypto";

const uploadPurchaseDocumentSchema = z.object({
  transaction_id: z.string().uuid(),
  document_kind: z.enum(["valid_id", "proof_of_billing"]),
  id_type: z.enum(ACCEPTED_ID_TYPES).optional().or(z.literal("")),
});

export async function uploadPurchaseDocument(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = uploadPurchaseDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid document upload." };
  }
  const { transaction_id: transactionId, document_kind: documentKind, id_type: idType } = parsed.data;

  // The browser uploads the file to storage first; only its path comes through here.
  const storagePath = formData.get("storage_path");
  if (typeof storagePath !== "string" || !storagePath.startsWith(`${transactionId}/${documentKind}-`)) {
    return { error: "Select a file to upload." };
  }
  if (documentKind === "valid_id" && !idType) return { error: "Select the ID type." };

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, customer_id, transaction_kind")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx || tx.customer_id !== user.user.id) return { error: "Transaction not found." };
  if (tx.transaction_kind !== "buy") return { error: "Documents can only be uploaded for purchases." };

  // Buyer identification is exactly two valid IDs; a rejected one can be replaced.
  if (documentKind === "valid_id") {
    const { data: existing } = await supabase
      .from("transaction_documents")
      .select("document_kind, verification_state")
      .eq("transaction_id", transactionId);
    if (activeBuyerIdCount(existing ?? []) >= BUYER_ID_COUNT) {
      return { error: "You have already uploaded two valid IDs." };
    }
  }

  const { error: dbError } = await supabase.from("transaction_documents").insert({
    transaction_id: transactionId,
    document_kind: documentKind,
    // Only a valid ID carries an ID type; the form can still hold the last one picked.
    id_type: documentKind === "valid_id" ? idType || null : null,
    storage_path: storagePath,
    uploader_id: user.user.id,
    verification_state: "pending",
  });
  if (dbError) return { error: dbError.message };

  revalidatePath(`/my-transactions/${transactionId}`);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return { success: true };
}

export async function createBuyTransaction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = buyTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid buy request." };
  }

  const vehicleId = parsed.data.vehicle_id;

  // Create the transaction record.
  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      customer_id: user.user.id,
      transaction_kind: "buy",
      vehicle_id: vehicleId,
      current_state: "pending",
      created_by: user.user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Also create the inquiry for chat routing (R-09/R-10 reuse).
  const { error: inquiryError } = await supabase.from("inquiries").insert({
    customer_id: user.user.id,
    vehicle_id: vehicleId,
    intention_kind: "buy_now",
  });

  if (inquiryError) return { error: inquiryError.message };

  // Record initial status history.
  await supabase.from("transaction_status_history").insert({
    transaction_id: transaction.id,
    from_state: "pending",
    to_state: "pending",
    actor_id: user.user.id,
    reason: "Transaction created",
  });

  revalidatePath("/my-transactions");
  revalidatePath("/dashboard/transactions");
  return { success: true, id: transaction.id };
}

export async function saveBuyDetails(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = buyDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase details." };
  }

  const {
    transaction_id: transactionId,
    payment_method,
    final_price,
    arrangement_kind,
    schedule,
    location,
    notes,
    acknowledge_condition,
  } = parsed.data;

  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, customer_id, transaction_kind, current_state, queue_state, vehicles(current_price)")
    .eq("id", transactionId)
    .maybeSingle();
  if (!transaction || transaction.customer_id !== user.user.id) return { error: "Transaction not found." };
  const vehicle = Array.isArray(transaction.vehicles) ? transaction.vehicles[0] : transaction.vehicles;
  if (transaction.transaction_kind !== "buy") {
    return { error: "Purchase details can only be saved for buy transactions." };
  }
  // A submitted request (in review, or queued On Hold) keeps its details and time until it is decided.
  if ((transaction.current_state && transaction.current_state !== "pending") || transaction.queue_state) {
    return { error: "This request is already under review and can no longer be changed." };
  }
  const slot = schedule ? new Date(schedule) : null;
  if (slot && arrangement_kind === "gce_visit" && !isVisitSlot(slot)) {
    return { error: "Pick a future GCE visit slot on the hour." };
  }
  if (slot && arrangement_kind !== "gce_visit" && slot.getTime() <= Date.now()) {
    return { error: "Pick a future date and time." };
  }

  // Appendix C: after 2 no-shows or a Not Legit decline, a buyer may only visit GCE.
  if (arrangement_kind && arrangement_kind !== "gce_visit") {
    const { data: standing } = await supabase
      .from("customer_standing")
      .select("gce_visit_only")
      .eq("account_id", user.user.id)
      .maybeSingle();
    if (standing?.gce_visit_only) return { error: "Your account is limited to GCE visits." };
  }

  // §3/§4/§6 step 3: the condition acknowledgment comes before Meet Halfway, Delivery or financing.
  const needsAcknowledgment =
    arrangement_kind === "meetup" || arrangement_kind === "delivery" || payment_method === "financing";
  if (needsAcknowledgment && acknowledge_condition !== "yes") {
    const { data: existing } = await supabase
      .from("purchase_details")
      .select("condition_acknowledged_at")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    if (!existing?.condition_acknowledged_at) {
      return {
        error:
          "Review the car's condition and 360° view, then acknowledge it before choosing Meet Halfway or Delivery.",
      };
    }
  }

  const { error } = await supabase.from("purchase_details").upsert(
    {
      transaction_id: transactionId,
      payment_method,
      // A blank Final Price arrives as 0 (coerced ""); the sale is then at the Showroom price.
      final_price: final_price || vehicle?.current_price || null,
      arrangement_kind: arrangement_kind || null,
      ...(acknowledge_condition === "yes" ? { condition_acknowledged_at: new Date().toISOString() } : {}),
    },
    { onConflict: "transaction_id" },
  );

  if (error) return { error: error.message };

  // Create viewing arrangement if schedule provided.
  if (slot) {
    // Rebooking frees the buyer's previous slot. Customers have no UPDATE on arrangements, so the
    // release runs with the service role after the ownership check above.
    await releaseVisitSlots(createAdminClient(), transactionId);

    const { error: arrError } = await supabase.from("viewing_arrangements").insert({
      inquiry_id: null, // nullable — linked via purchase_transaction_id
      purchase_transaction_id: transactionId,
      arrangement_kind: arrangement_kind || "gce_visit",
      schedule: slot.toISOString(),
      location: location || null,
      notes,
    });

    // 23505: the slot lock index (00050) — another buyer holds this car at this time.
    if (arrError?.code === "23505") return { error: "That visit slot is already taken. Choose another time." };
    if (arrError) return { error: arrError.message };
  }

  revalidatePath(`/my-transactions/${transactionId}`);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  return { success: true };
}

// §2 steps 3–4 and §3 step 4: a Cash request with two IDs goes to the Sales Manager.
// A GCE visit holds a locked slot; a Meet Halfway request joins the car's queue, Active if no other
// request is Active, otherwise On Hold until the Sales Manager promotes it.
export async function submitBuyRequest(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const transactionId = z.string().uuid().safeParse(formData.get("transaction_id"));
  if (!transactionId.success) return { error: "Invalid request." };

  const { data: tx } = await supabase
    .from("transactions")
    .select(
      "id, customer_id, vehicle_id, transaction_kind, current_state, queue_state, purchase_details(payment_method, arrangement_kind, condition_acknowledged_at)",
    )
    .eq("id", transactionId.data)
    .maybeSingle();
  if (!tx || tx.customer_id !== user.user.id || tx.transaction_kind !== "buy") {
    return { error: "Transaction not found." };
  }
  if (tx.current_state !== "pending" || tx.queue_state) return { error: "This request is already submitted." };

  const details = (Array.isArray(tx.purchase_details) ? tx.purchase_details[0] : tx.purchase_details) ?? null;
  const queued = isQueuedRequest(details);
  // §6: a financing buyer books the GCE visit only after the financing is approved.
  const financing = isFinancingRequest(details);
  if (!queued && !isOnsiteCashRequest(details)) {
    return {
      error:
        "Save Cash or Bank Transfer with GCE Visit, Meet Halfway or Delivery, or In-House Financing with GCE Visit, as the arrangement.",
    };
  }
  if (queued && !details?.condition_acknowledged_at) return { error: "Acknowledge the car's condition first." };

  const [{ data: documents }, { data: slot }, { data: standing }] = await Promise.all([
    supabase.from("transaction_documents").select("document_kind, verification_state").eq("transaction_id", tx.id),
    supabase
      .from("viewing_arrangements")
      .select("schedule, arrangement_kind")
      .eq("purchase_transaction_id", tx.id)
      .in("confirmation_state", ["pending", "confirmed"])
      .maybeSingle(),
    supabase.from("customer_standing").select("gce_visit_only").eq("account_id", user.user.id).maybeSingle(),
  ]);
  if (activeBuyerIdCount(documents ?? []) !== BUYER_ID_COUNT) return { error: "Upload two valid IDs first." };
  if (queued && standing?.gce_visit_only) return { error: "Your account is limited to GCE visits." };
  const scheduledAt = slot ? new Date(slot.schedule) : null;
  if (!financing) {
    if (!slot || !scheduledAt || slot.arrangement_kind !== details?.arrangement_kind) {
      return { error: "Book the meeting time first." };
    }
    if (queued ? scheduledAt.getTime() <= Date.now() : !isVisitSlot(scheduledAt)) {
      return { error: "The booked time has passed. Pick a new one." };
    }
  }

  // Customers cannot move their own request into review under RLS; ownership is checked above.
  const admin = createAdminClient();
  const review = { current_state: "under_review", flow_status: "pending_sm_approval", review_due_at: reviewDueAt() };
  let queueState: "active" | "on_hold" | null = null;
  let error: { code?: string; message: string } | null = null;

  if (queued) {
    const { count: activeCount } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", tx.vehicle_id)
      .eq("queue_state", "active");
    queueState = nextQueueState((activeCount ?? 0) > 0);
    if (queueState === "active") {
      ({ error } = await admin
        .from("transactions")
        .update({ ...review, queue_state: "active" })
        .eq("id", tx.id)
        .eq("current_state", "pending"));
      // 23505: another request became Active a moment ago (one Active per car, 00051).
      if (error?.code === "23505") queueState = "on_hold";
    }
    if (queueState === "on_hold") {
      ({ error } = await admin.from("transactions").update({ queue_state: "on_hold" }).eq("id", tx.id));
    }
  } else {
    ({ error } = await admin.from("transactions").update(review).eq("id", tx.id).eq("current_state", "pending"));
  }
  if (error) return { error: error.message };

  const onHold = queueState === "on_hold";
  await admin.from("transaction_status_history").insert({
    transaction_id: tx.id,
    from_state: "pending",
    to_state: onHold ? "pending" : "under_review",
    actor_id: user.user.id,
    reason: queued
      ? `Buyer submitted ${financing ? "an In-House Financing" : `a Cash ${details?.arrangement_kind === "delivery" ? "Delivery" : "Meet Halfway"}`} request (${onHold ? "On Hold" : "Active"})`
      : "Buyer submitted a Cash request with a GCE visit slot",
  });
  const when = scheduledAt ? scheduledAt.toLocaleString("en-PH") : "";
  await notify(
    admin,
    { userId: user.user.id },
    {
      kind: onHold ? "buy_request_on_hold" : "buy_request_submitted",
      title: onHold ? "Your request is On Hold" : "Your request was submitted",
      body: onHold
        ? "Another buyer's request for this car is being processed. Yours stays in the queue and you will be notified."
        : "The Sales Manager will review your request within 7 days.",
      transactionId: tx.id,
    },
  );
  if (!onHold) {
    await notify(
      admin,
      { role: "sales_manager" },
      {
        kind: "buy_request_submitted",
        title: "New buyer request to review",
        body: financing
          ? "A buyer asked for In-House Financing. Review within 7 days, then agree the payment duration."
          : `A Cash buyer ${queued ? (details?.arrangement_kind === "delivery" ? "asked for delivery" : "asked to meet halfway") : "booked a GCE visit"} on ${when}. Review within 7 days.`,
        transactionId: tx.id,
      },
    );
  }

  revalidatePath(`/my-transactions/${tx.id}`);
  revalidatePath("/dashboard/transactions");
  return { success: true, queueState };
}

// §6 steps 11–12: the buyer reviews the approved financing. Declining closes the request with nothing
// paid; proceeding books the inspection visit. No downpayment is taken before the car is inspected.
export async function respondToFinancingOffer(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = z
    .object({
      transaction_id: z.string().uuid(),
      decision: z.enum(["proceed", "decline"]),
      schedule: z.string().optional().or(z.literal("")),
      location: z.string().trim().max(300).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid response." };

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, customer_id, transaction_kind, current_state, flow_status, purchase_details(arrangement_kind)")
    .eq("id", parsed.data.transaction_id)
    .maybeSingle();
  if (!tx || tx.customer_id !== user.user.id || tx.transaction_kind !== "buy")
    return { error: "Transaction not found." };
  if (tx.flow_status !== "approved_awaiting_buyer_decision") return { error: "There is no financing offer to answer." };

  const admin = createAdminClient();
  if (parsed.data.decision === "decline") {
    await admin
      .from("transactions")
      .update({ current_state: "cancelled", completed_at: new Date().toISOString(), flow_status: null })
      .eq("id", tx.id);
    await admin.from("transaction_status_history").insert({
      transaction_id: tx.id,
      from_state: tx.current_state,
      to_state: "cancelled",
      actor_id: user.user.id,
      reason: "Buyer did not proceed with the approved financing",
    });
    await notify(
      admin,
      { role: "sales_manager" },
      {
        kind: "financing_declined",
        title: "Buyer declined the financing offer",
        body: "The request is closed with nothing paid. Promote the next On Hold buyer for this car.",
        transactionId: tx.id,
      },
    );
    revalidatePath(`/my-transactions/${tx.id}`);
    return { success: true };
  }

  // §6 books a GCE visit. Phase 6 defaults: §10 books a Calabarzon meet-up instead, and §11 a delivery,
  // which goes straight to the claim: the Sales Manager then sets the delivery terms (§4) and the
  // Initial Downpayment is the delivery downpayment.
  const details = Array.isArray(tx.purchase_details) ? tx.purchase_details[0] : tx.purchase_details;
  const kind = (details?.arrangement_kind as "gce_visit" | "meetup" | "delivery" | undefined) ?? "gce_visit";
  const label = { gce_visit: "GCE visit", meetup: "meet-up", delivery: "delivery" }[kind];
  const visit = parsed.data.schedule ? new Date(parsed.data.schedule) : null;
  if (!visit || (kind === "gce_visit" ? !isVisitSlot(visit) : visit.getTime() <= Date.now())) {
    return {
      error: kind === "gce_visit" ? "Pick a future GCE visit slot on the hour." : `Pick a future ${label} time.`,
    };
  }
  if (kind !== "gce_visit" && !parsed.data.location) {
    return { error: kind === "delivery" ? "Enter the delivery address." : "Enter the meet-up location." };
  }
  // A time saved before approval is replaced by this appointment.
  await releaseVisitSlots(admin, tx.id);
  const { error: slotError } = await supabase.from("viewing_arrangements").insert({
    inquiry_id: null,
    purchase_transaction_id: tx.id,
    arrangement_kind: kind,
    schedule: visit.toISOString(),
    location: kind === "gce_visit" ? null : parsed.data.location,
    notes: kind === "delivery" ? "Financed delivery" : "Vehicle inspection and purchase decision appointment",
  });
  if (slotError?.code === "23505") return { error: "That visit slot is already taken. Choose another time." };
  if (slotError) return { error: slotError.message };

  await admin
    .from("transactions")
    .update({ flow_status: kind === "delivery" ? "purchase_claim" : "gce_visit_scheduled_dp_pending" })
    .eq("id", tx.id);
  await admin.from("transaction_status_history").insert({
    transaction_id: tx.id,
    from_state: tx.current_state,
    to_state: tx.current_state,
    actor_id: user.user.id,
    reason: `Buyer accepted the financing and booked a ${label} for ${visit.toLocaleString("en-PH")}`,
  });
  await notify(
    admin,
    { role: "sales_manager" },
    {
      kind: "financing_visit_booked",
      title: `Financing buyer booked a ${label}`,
      body:
        kind === "delivery"
          ? `Delivery on ${visit.toLocaleString("en-PH")}. Confirm the address and set the delivery terms.`
          : `Inspection and purchase decision ${label} on ${visit.toLocaleString("en-PH")}.`,
      transactionId: tx.id,
    },
  );
  revalidatePath(`/my-transactions/${tx.id}`);
  revalidatePath(`/dashboard/transactions/${tx.id}`);
  return { success: true };
}

const SELL_PHOTO_MAX_COUNT = 6;
const SELL_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idTypeSchema = z.enum(ACCEPTED_ID_TYPES);

type SellDocumentKind = "sell_photo" | "valid_id" | "orcr" | "deed_of_sale";
// Selling step 1: two valid IDs, the ORCR and the deed of sale are required with every offer.
const SELL_PAPER_KINDS: SellDocumentKind[] = ["valid_id", "valid_id", "orcr", "deed_of_sale"];

type SellUpload = { path: string; document_kind: SellDocumentKind; id_type: string | null };
export type SellFileMeta = { kind: SellDocumentKind; type: string; size: number };

const sellPathPrefix = (transactionId: string, kind: SellDocumentKind) =>
  `${transactionId}/${kind.replace(/_/g, "-")}-`;

// Files are listed as photos first, then the papers in SELL_PAPER_KINDS order.
function sellFilesError(files: SellFileMeta[]): string | null {
  const photos = files.filter((f) => f.kind === "sell_photo");
  const papers = files.filter((f) => f.kind !== "sell_photo");
  if (photos.length === 0) return "At least one vehicle photo is required.";
  if (photos.length > SELL_PHOTO_MAX_COUNT) return `You can upload at most ${SELL_PHOTO_MAX_COUNT} photos.`;
  if (papers.length !== SELL_PAPER_KINDS.length || papers.some((f, i) => f.kind !== SELL_PAPER_KINDS[i])) {
    return "Attach two valid IDs with their ID types, the ORCR and the deed of sale.";
  }
  for (const file of files) {
    if (file.kind === "sell_photo" && !SELL_PHOTO_MIME_TYPES.includes(file.type)) {
      return "Photos must be JPEG, PNG, or WebP images.";
    }
    if (!DOCUMENT_EXTENSIONS[file.type]) return "Papers must be JPEG, PNG, WebP or PDF files.";
    if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) return "Each file must be 5MB or smaller.";
  }
  return null;
}

// Vercel rejects function request bodies over 4.5 MB, so the browser uploads the photos and
// papers straight to storage with these signed URLs, into the folder of the transaction id
// that submitSellVehicle later creates.
// ponytail: an abandoned form leaves its files in an unused folder; add a cleanup job if storage grows.
export async function prepareSellUploads(files: SellFileMeta[]) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const fileError = sellFilesError(files);
  if (fileError) return { error: fileError };

  const transactionId = randomUUID();
  const admin = createAdminClient();
  const uploads: { path: string; token: string }[] = [];
  for (const file of files) {
    const path = `${sellPathPrefix(transactionId, file.kind)}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${DOCUMENT_EXTENSIONS[file.type]}`;
    const { data, error } = await admin.storage.from("transaction-documents").createSignedUploadUrl(path);
    if (error || !data) return { error: error?.message ?? "Could not prepare the upload." };
    uploads.push({ path: data.path, token: data.token });
  }
  return { transactionId, uploads };
}

function readSellUploads(formData: FormData, transactionId: string): { uploads: SellUpload[] } | { error: string } {
  const pathOf = (value: FormDataEntryValue | null, kind: SellDocumentKind) =>
    typeof value === "string" && value.startsWith(sellPathPrefix(transactionId, kind)) ? value : null;

  const photoPaths = formData.getAll("photo_paths").map((value) => pathOf(value, "sell_photo"));
  if (photoPaths.length === 0) return { error: "At least one vehicle photo is required." };
  if (photoPaths.length > SELL_PHOTO_MAX_COUNT) {
    return { error: `You can upload at most ${SELL_PHOTO_MAX_COUNT} photos.` };
  }
  const uploads: SellUpload[] = [];
  for (const path of photoPaths) {
    if (!path) return { error: "Invalid vehicle photo." };
    uploads.push({ path, document_kind: "sell_photo", id_type: null });
  }
  for (const n of [1, 2]) {
    const path = pathOf(formData.get(`id_path_${n}`), "valid_id");
    const idType = idTypeSchema.safeParse(formData.get(`id_type_${n}`));
    if (!path || !idType.success) return { error: "Two valid IDs, each with its ID type, are required." };
    uploads.push({ path, document_kind: "valid_id", id_type: idType.data });
  }
  const orcr = pathOf(formData.get("orcr_path"), "orcr");
  if (!orcr) return { error: "The ORCR is required." };
  uploads.push({ path: orcr, document_kind: "orcr", id_type: null });
  const deed = pathOf(formData.get("deed_of_sale_path"), "deed_of_sale");
  if (!deed) return { error: "The deed of sale is required." };
  uploads.push({ path: deed, document_kind: "deed_of_sale", id_type: null });
  return { uploads };
}

export async function submitSellVehicle(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = sellVehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details." };
  }

  // The files are already in storage (prepareSellUploads); only their paths come through here.
  const transactionId = formData.get("transaction_id");
  if (typeof transactionId !== "string" || !UUID_PATTERN.test(transactionId)) {
    return { error: "Invalid upload. Please try again." };
  }
  const uploadResult = readSellUploads(formData, transactionId);
  if ("error" in uploadResult) return { error: uploadResult.error };
  const { uploads } = uploadResult;
  // Customers have no DELETE policy on storage, so clean-up runs as admin.
  const removeUploads = () =>
    createAdminClient()
      .storage.from("transaction-documents")
      .remove(uploads.map((upload) => upload.path));

  // Optional condition parts/issues checklist: JSON string of node ids.
  let conditionItems: string[] = [];
  const rawConditionItems = formData.get("condition_items");
  if (typeof rawConditionItems === "string" && rawConditionItems.trim()) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(rawConditionItems);
    } catch {
      return { error: "Invalid condition checklist." };
    }
    if (
      !Array.isArray(decoded) ||
      decoded.length > 200 ||
      !decoded.every((id): id is string => typeof id === "string" && UUID_PATTERN.test(id))
    ) {
      return { error: "Invalid condition checklist." };
    }
    conditionItems = [...new Set(decoded)];
  }

  const data = parsed.data;
  let finalCondition: string = data.condition;
  const rawDetail = (data as unknown as { condition_detail?: string }).condition_detail;
  if (finalCondition.toLowerCase() === "other" && rawDetail?.trim()) {
    const trimmed = rawDetail.trim();
    const map: Record<string, string> = {
      excellent: "Excellent",
      good: "Good",
      fair: "Fair",
      needs_repair: "Needs Repair",
      "needs repair": "Needs Repair",
    };
    const lower = trimmed.toLowerCase();
    finalCondition = map[lower] ?? trimmed;
  }

  // Create the sell transaction under the id its files were uploaded for.
  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      id: transactionId,
      customer_id: user.user.id,
      transaction_kind: "sell",
      current_state: "pending",
      created_by: user.user.id,
    })
    .select()
    .single();

  // No file clean-up here: a failed insert may mean the id belongs to someone else's transaction.
  if (error) return { error: error.message };

  const { error: detailError } = await supabase.from("sell_details").insert({
    transaction_id: transaction.id,
    offered_amount: data.offered_amount,
    condition_items: conditionItems,
    has_known_issues: data.has_known_issues === "yes",
    declared_issues: data.has_known_issues === "yes" ? data.declared_issues : null,
    meetup_method: data.meetup_method,
  });

  if (detailError) {
    await removeUploads();
    await supabase.from("transactions").delete().eq("id", transaction.id);
    return { error: detailError.message };
  }

  for (const upload of uploads) {
    // Photos are attachments and land verified; the papers wait for the Marketing Specialist.
    const { error: docError } = await supabase.from("transaction_documents").insert({
      transaction_id: transaction.id,
      document_kind: upload.document_kind,
      id_type: upload.id_type,
      storage_path: upload.path,
      uploader_id: user.user.id,
      verification_state: upload.document_kind === "sell_photo" ? "verified" : "pending",
    });
    if (docError) {
      await removeUploads();
      await supabase.from("transactions").delete().eq("id", transaction.id);
      return { error: docError.message };
    }
  }

  // Create a draft vehicle record for the offered vehicle.
  // The ID is generated here because INSERT ... RETURNING is subject to the
  // SELECT RLS policies, which do not allow customers to read draft vehicles.
  const vehicleId = randomUUID();
  const stockCode = `SELL-${data.make.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const { error: vehicleError } = await supabase.from("vehicles").insert({
    id: vehicleId,
    stock_code: stockCode,
    make: data.make,
    model: data.model,
    year: data.year,
    mileage: data.mileage,
    condition: finalCondition,
    description: data.description ?? null,
    listing_state: "draft",
  });

  if (vehicleError) {
    await supabase.from("transactions").delete().eq("id", transaction.id);
    return { error: vehicleError.message };
  }

  // Link the vehicle back to the transaction.
  await supabase.from("transactions").update({ vehicle_id: vehicleId }).eq("id", transaction.id);

  // Selling step 5: the negotiation happens in this thread, so it exists from the start.
  const { error: threadError } = await supabase.from("inquiries").insert({
    customer_id: user.user.id,
    vehicle_id: vehicleId,
    intention_kind: "sell_negotiation",
    transaction_id: transaction.id,
  });
  if (threadError) {
    await supabase.from("transactions").delete().eq("id", transaction.id);
    return { error: threadError.message };
  }

  // Record status history.
  await supabase.from("transaction_status_history").insert({
    transaction_id: transaction.id,
    from_state: "pending",
    to_state: "pending",
    actor_id: user.user.id,
    reason: "Sell transaction created",
  });

  revalidatePath("/my-transactions");
  revalidatePath("/dashboard/transactions");
  return { success: true, id: transaction.id };
}

export async function submitRequestCar(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const parsed = requestCarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request details." };
  }

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      customer_id: user.user.id,
      transaction_kind: "request_a_car",
      current_state: "pending",
      created_by: user.user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const { error: reqError } = await supabase.from("vehicle_requests").insert({
    transaction_id: transaction.id,
    requested_make: parsed.data.requested_make,
    requested_model: parsed.data.requested_model,
    year_min: parsed.data.year_min ?? null,
    year_max: parsed.data.year_max ?? null,
    budget: parsed.data.budget,
    other_preferences: parsed.data.other_preferences || null,
  });

  if (reqError) return { error: reqError.message };

  await supabase.from("transaction_status_history").insert({
    transaction_id: transaction.id,
    from_state: "pending",
    to_state: "pending",
    actor_id: user.user.id,
    reason: "Request-a-Car transaction created",
  });

  revalidatePath("/my-transactions");
  revalidatePath("/dashboard/transactions");
  return { success: true, id: transaction.id };
}

export async function cancelTransaction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string) || null;

  const { data: tx } = await supabase.from("transactions").select("current_state").eq("id", id).single();

  if (!tx) return { error: "Transaction not found" };

  const currentState = tx.current_state as string;
  if (["completed", "cancelled", "rejected"].includes(currentState)) {
    return { error: "This transaction can no longer be cancelled." };
  }

  // §3 cancellation rule: a meet-up or delivery can be cancelled only 5 hours or more before it.
  // The database enforces the same cut-off (00051); this answers with a readable message first.
  const { data: scheduled } = await supabase
    .from("viewing_arrangements")
    .select("schedule")
    .eq("purchase_transaction_id", id)
    .in("arrangement_kind", ["meetup", "delivery"])
    .in("confirmation_state", ["pending", "confirmed"]);
  if ((scheduled ?? []).some((arrangement) => !canCancelScheduled(arrangement.schedule))) {
    return { error: "Cancellation is only allowed 5 hours or more before the scheduled time." };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      current_state: "cancelled",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("customer_id", user.user.id);

  if (error) return { error: error.message };

  const { error: historyError } = await supabase.from("transaction_status_history").insert({
    transaction_id: id,
    from_state: currentState,
    to_state: "cancelled",
    actor_id: user.user.id,
    reason: reason ?? "Cancelled by customer",
  });

  if (historyError) return { error: historyError.message };

  // A cancelled request gives its visit slot back to other buyers.
  await releaseVisitSlots(createAdminClient(), id);

  revalidatePath(`/my-transactions/${id}`);
  revalidatePath("/my-transactions");
  revalidatePath(`/dashboard/transactions/${id}`);
  return { success: true };
}
