"use client";

// Phase 5: the customer buy and sell actions run in the browser and call Laravel
// (backend/app/Http/Controllers/Trading/CustomerTradingController.php and SellIntakeController.php), which
// checks ownership, states and locks. Exports, arguments and results are the same as the old Server Actions.
// The PayMongo checkout actions call Laravel too (./online-payment-actions.ts, Phase 6).

import { type ActionResult, apiAction, laravelForm } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { profileAddressColumns, profileAddressSchema } from "@/lib/validation/profile";
import { buyDetailsSchema, buyTransactionSchema, sellVehicleSchema } from "@/lib/validation/transactions";

export { startInstallmentCheckout, startOnlinePayment } from "./online-payment-actions";

// SN-13: an offer uploads its photos and the two valid IDs only; the OR, the CR and the deed of sale are declared
// on the papers checklist and checked against the originals.
type SellDocumentKind = "sell_photo" | "valid_id" | "issue_photo";
export type SellFileMeta = { kind: SellDocumentKind; type: string; size: number };

/** The buyer's PSGC address: Laravel stores the codes and the one-line address composed here, as for the profile. */
function withAddress(formData: FormData): { error: string } | { body: Record<string, FormDataEntryValue> } {
  const parsed = profileAddressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose the region, city and barangay." };
  return {
    body: { ...Object.fromEntries(formData), ...profileAddressColumns(parsed.data) } as Record<
      string,
      FormDataEntryValue
    >,
  };
}

/** SN-14: a customer cannot delete a submitted document. This uploads a replacement after staff asked for one. */
export async function uploadPurchaseDocument(formData: FormData) {
  return apiAction("/trading/purchase-documents", Object.fromEntries(formData));
}

export async function createBuyTransaction(formData: FormData) {
  const parsed = buyTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid buy request." } as ActionResult<{ id: string }>;
  return apiAction<{ id: string }>("/trading/buy", parsed.data);
}

export async function saveBuyDetails(formData: FormData) {
  const parsed = buyDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid purchase details." } as ActionResult;
  const kind = parsed.data.arrangement_kind;
  // BH-8: a Meet Halfway meet-up is a map pin inside CALABARZON; only delivery still composes a PSGC address.
  if (kind === "delivery") {
    const address = withAddress(formData);
    if ("error" in address) return address as ActionResult;
    return apiAction("/trading/buy-details", address.body);
  }
  return apiAction("/trading/buy-details", Object.fromEntries(formData));
}

export async function submitBuyRequest(formData: FormData) {
  return apiAction<{ queueState: "active" | "on_hold" | null }>("/trading/submit-buy-request", {
    transaction_id: formData.get("transaction_id"),
  });
}

export async function respondToFinancingOffer(formData: FormData) {
  if (formData.get("decision") === "proceed" && formData.has("region_code")) {
    // A delivery saves the buyer's PSGC address; a meet-up sends its pin and address instead.
    const address = profileAddressSchema.safeParse(Object.fromEntries(formData));
    if (address.success) {
      return apiAction("/trading/financing-offer", {
        ...Object.fromEntries(formData),
        ...profileAddressColumns(address.data),
      });
    }
  }
  return apiAction("/trading/financing-offer", Object.fromEntries(formData));
}

// The browser stores each file with a grant for the transaction id Laravel picks here.
export async function prepareSellUploads(files: SellFileMeta[]) {
  try {
    return await browserApi<{ transactionId: string; uploads: { path: string; token: string }[] }>(
      "POST",
      "/api/v1/trading/sell/prepare-uploads",
      { files },
    );
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function submitSellVehicle(formData: FormData) {
  const parsed = sellVehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details." } as ActionResult<{ id: string }>;
  return apiAction<{ id: string }>("/trading/sell", laravelForm(formData));
}

export async function requestDeliveryReschedule(
  formData: FormData,
): Promise<{ error: string } | { success: true; url?: string }> {
  const address = withAddress(formData);
  if ("error" in address) return address;
  const result = await apiAction<{ url?: string }>("/trading/delivery-reschedule", address.body);
  return result.error !== undefined ? { error: result.error } : result;
}

export async function signContract(formData: FormData) {
  return apiAction("/trading/sign-contract", Object.fromEntries(formData));
}

export async function cancelTransaction(formData: FormData) {
  return apiAction("/trading/cancel", Object.fromEntries(formData));
}
