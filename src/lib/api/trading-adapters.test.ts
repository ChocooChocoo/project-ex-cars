import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase 5: the trading actions are thin browser adapters. Their rules are asserted where they now run
// (backend/tests/Feature/Trading/TransitionTest.php and ConcurrencyTest.php); this checks the wiring: the
// endpoint, the body, the old result shapes, and the page reload after a success.
const { api, revalidate } = vi.hoisted(() => ({ api: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ browserApi: api }));
vi.mock("@/lib/api/revalidate", () => ({ revalidatePath: revalidate }));
// Phase 6 payment actions are covered by payment-adapters.test.ts; stubbed here.
vi.mock("@/app/(customer)/my-transactions/online-payment-actions", () => ({
  startOnlinePayment: vi.fn(),
  startInstallmentCheckout: vi.fn(),
}));
vi.mock("@/app/(staff)/transactions/payment-actions", () => ({}));

import * as inquiries from "@/app/(customer)/my-inquiries/server-actions";
import * as customer from "@/app/(customer)/my-transactions/actions";
import * as review from "@/app/(customer)/my-transactions/review-actions";
import * as fieldCases from "@/app/(staff)/field-cases/actions";
import * as fieldDelivery from "@/app/(staff)/field-cases/delivery-actions";
import * as location from "@/app/(staff)/field-cases/location-actions";
import * as recovery from "@/app/(staff)/field-cases/recovery-actions";
import * as sellInspection from "@/app/(staff)/field-cases/sell-inspection-actions";
import * as staff from "@/app/(staff)/transactions/actions";
import * as delivery from "@/app/(staff)/transactions/delivery-actions";
import * as financing from "@/app/(staff)/transactions/financing-actions";
import * as handover from "@/app/(staff)/transactions/handover-actions";
import * as sell from "@/app/(staff)/transactions/sell-actions";
import * as vehicles from "@/app/(staff)/vehicles/actions";
import * as reconditioning from "@/app/(staff)/vehicles/reconditioning-actions";
import { ApiError } from "@/lib/api/errors";

const TX = "11111111-1111-4111-8111-111111111111";
const fd = (entries: Record<string, string | string[]>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) for (const v of [value].flat()) form.append(key, v);
  return form;
};

beforeEach(() => {
  vi.clearAllMocks();
  api.mockResolvedValue({ success: true });
});

describe("form actions post their fields to one Laravel endpoint each", () => {
  const cases: [string, (form: FormData) => Promise<unknown>, string][] = [
    ["submitBuyRequest", customer.submitBuyRequest, "/api/v1/trading/submit-buy-request"],
    ["signContract", customer.signContract, "/api/v1/trading/sign-contract"],
    ["cancelTransaction", customer.cancelTransaction, "/api/v1/trading/cancel"],
    ["uploadPurchaseDocument", customer.uploadPurchaseDocument, "/api/v1/trading/purchase-documents"],
    ["transitionTransaction", staff.transitionTransaction, "/api/v1/staff/trading/transition"],
    ["recordBuyerDecline", staff.recordBuyerDecline, "/api/v1/staff/trading/buyer-decline"],
    ["recordNoShow", staff.recordNoShow, "/api/v1/staff/trading/no-show"],
    ["promoteQueuedRequest", staff.promoteQueuedRequest, "/api/v1/staff/trading/promote"],
    ["verifyTransactionDocument", staff.verifyTransactionDocument, "/api/v1/staff/trading/verify-document"],
    ["createFieldCase", staff.createFieldCase, "/api/v1/staff/trading/field-cases"],
    ["assignMechanic", staff.assignMechanic, "/api/v1/staff/trading/assign-mechanic"],
    ["instructRepossession", staff.instructRepossession, "/api/v1/staff/trading/repossession"],
    ["setDeliveryTerms", delivery.setDeliveryTerms, "/api/v1/staff/trading/delivery-terms"],
    ["createDeliveryFieldCase", delivery.createDeliveryFieldCase, "/api/v1/staff/trading/delivery-case"],
    ["createMeetupFieldCase", delivery.createMeetupFieldCase, "/api/v1/staff/trading/meetup-case"],
    ["relayDeliveryDelay", delivery.relayDeliveryDelay, "/api/v1/staff/trading/delivery-delay"],
    ["cancelUnpaidDelivery", delivery.cancelUnpaidDelivery, "/api/v1/staff/trading/cancel-unpaid-delivery"],
    ["recordVisitDecision", financing.recordVisitDecision, "/api/v1/staff/trading/visit-decision"],
    ["recordVehicleRecovered", financing.recordVehicleRecovered, "/api/v1/staff/trading/vehicle-recovered"],
    ["requestPapersRelease", handover.requestPapersRelease, "/api/v1/staff/trading/handover/request-papers-release"],
    ["reportSigning", handover.reportSigning, "/api/v1/staff/trading/handover/report-signing"],
    ["flagSellSubmission", sell.flagSellSubmission, "/api/v1/staff/trading/sell/flag-sell-submission"],
    ["recordSellerResponse", sell.recordSellerResponse, "/api/v1/staff/trading/sell/record-seller-response"],
    ["updateFieldCase", fieldCases.updateFieldCase, "/api/v1/staff/field/update-field-case"],
    ["advanceDeliveryStatus", fieldDelivery.advanceDeliveryStatus, "/api/v1/staff/field/advance-delivery-status"],
    ["advanceRecovery", recovery.advanceRecovery, "/api/v1/staff/field/advance-recovery"],
    ["confirmFieldCheck", sellInspection.confirmFieldCheck, "/api/v1/staff/field/confirm-field-check"],
    ["approvePrice", vehicles.approvePrice, "/api/v1/staff/vehicles/approve-price"],
    ["startReconditioning", reconditioning.startReconditioning, "/api/v1/staff/reconditioning/start"],
  ];
  it.each(cases)("%s", async (_name, action, path) => {
    await expect(action(fd({ transaction_id: TX, decision: "x" }))).resolves.toEqual({ success: true });
    expect(api).toHaveBeenCalledWith("POST", path, expect.objectContaining({ transaction_id: TX }));
    expect(revalidate).toHaveBeenCalled();
  });
});

describe("results and errors keep the old shapes", () => {
  it("turns a refused step into { error } with Laravel's message and reloads nothing", async () => {
    api.mockRejectedValue(new ApiError(409, { code: "conflict", message: "This request is already submitted." }));
    await expect(customer.submitBuyRequest(fd({ transaction_id: TX }))).resolves.toEqual({
      error: "This request is already submitted.",
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("passes success fields through (queueState, id)", async () => {
    api.mockResolvedValue({ success: true, queueState: "on_hold" });
    await expect(customer.submitBuyRequest(fd({ transaction_id: TX }))).resolves.toEqual({
      success: true,
      queueState: "on_hold",
    });
    api.mockResolvedValue({ success: true, id: TX });
    await expect(customer.createBuyTransaction(fd({ vehicle_id: TX }))).resolves.toEqual({ success: true, id: TX });
  });

  it("keeps the zod messages before calling Laravel", async () => {
    await expect(review.submitReview(fd({ transaction_id: TX, rating: "5", body: " " }))).resolves.toEqual({
      error: "Write your review.",
    });
    await expect(customer.createBuyTransaction(fd({ vehicle_id: "nope" }))).resolves.toHaveProperty("error");
    expect(api).not.toHaveBeenCalled();
  });

  it("sends repeated form keys as PHP arrays and files as multipart", async () => {
    await staff.recordPaperwork(fd({ transaction_id: TX, document_kind: "invoice" }));
    await sellInspection.reportInspection(fd({ field_case_id: TX, photos: ["a", "b"] }));
    const sent = api.mock.calls[1][2] as FormData;
    expect(sent).toBeInstanceOf(FormData);
    expect(sent.getAll("photos[]")).toEqual(["a", "b"]);
  });

  it("calls the id- and argument-style actions with their own routes", async () => {
    await customer.removePurchaseDocument(TX);
    expect(api).toHaveBeenLastCalledWith("DELETE", `/api/v1/trading/purchase-documents/${TX}`, undefined);
    await vehicles.archiveVehicle(TX);
    expect(api).toHaveBeenLastCalledWith("POST", `/api/v1/staff/vehicles/${TX}/archive`, undefined);
    await sellInspection.recordFieldPrice(TX, { status: "negotiated" });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/field/record-field-price", {
      field_case_id: TX,
      status: "negotiated",
    });
    await inquiries.reviewReport(TX, "dismiss");
    expect(api).toHaveBeenLastCalledWith("POST", `/api/v1/staff/message-reports/${TX}/review`, { decision: "dismiss" });
    api.mockResolvedValue({ success: true, lat: 14.2, lng: 121, at: null });
    await expect(location.getFieldCaseLocation(TX)).resolves.toEqual({ success: true, lat: 14.2, lng: 121, at: null });
    expect(api).toHaveBeenLastCalledWith("GET", `/api/v1/field-cases/${TX}/location`);
  });
});
