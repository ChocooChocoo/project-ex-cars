import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase 6: the payment actions are thin browser adapters. Their rules are asserted where they now run
// (backend/tests/Feature/Finance/PaymentFlowTest.php, CheckoutTest.php and PaymentConcurrencyTest.php); this
// checks the wiring: the endpoint, the body and the old result shapes.
const { api, revalidate } = vi.hoisted(() => ({ api: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ browserApi: api }));
vi.mock("@/lib/api/revalidate", () => ({ revalidatePath: revalidate }));

import * as checkout from "@/app/(customer)/my-transactions/online-payment-actions";
import * as finance from "@/app/(staff)/finance/actions";
import * as financing from "@/app/(staff)/transactions/financing-terms-actions";
import * as payments from "@/app/(staff)/transactions/payment-actions";
import * as review from "@/app/(staff)/transactions/payment-review-actions";
import * as funds from "@/app/(staff)/vehicles/reconditioning-fund-actions";
import { ApiError } from "@/lib/api/errors";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  api.mockResolvedValue({ success: true });
});

describe("payment actions call one Laravel endpoint each", () => {
  it("posts the staff payment forms as multipart, with repeated installments as an array", async () => {
    const form = new FormData();
    form.set("transaction_id", ID);
    form.append("installment_ids", "a");
    form.append("installment_ids", "b");
    api.mockResolvedValue({ success: true, recorded: 2 });
    await expect(payments.recordAdvancePayment(form)).resolves.toEqual({ success: true, recorded: 2 });
    const [method, path, body] = api.mock.calls[0];
    expect([method, path]).toEqual(["POST", "/api/v1/staff/payments/advance"]);
    expect((body as FormData).getAll("installment_ids[]")).toEqual(["a", "b"]);

    await payments.recordPayment(form);
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payments/record", expect.any(FormData));
  });

  it("sends the id-style actions to their own routes", async () => {
    await payments.verifyPayment(ID);
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payments/verify", { payment_id: ID });
    await payments.markInstallmentWaived(ID);
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payments/waive-installment", { installment_id: ID });
    await review.approveOnlineInstallment(ID);
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payments/approve-online", { payment_id: ID });
    await review.rejectPayment(ID, "Blurry receipt");
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/payments/reject", {
      payment_id: ID,
      reason: "Blurry receipt",
    });
  });

  it("posts the financing terms forms to their own routes", async () => {
    const form = new FormData();
    form.set("transaction_id", ID);
    form.set("decision", "confirm");
    for (const [action, path] of [
      [financing.proposeFinancingTerms, "propose"],
      [financing.reviewFinancingTerms, "review"],
      [financing.confirmFinancingTerms, "confirm"],
      [financing.completeFinancingAgreement, "complete"],
    ] as const) {
      await expect(action(form)).resolves.toEqual({ success: true });
      expect(api).toHaveBeenLastCalledWith("POST", `/api/v1/staff/financing/${path}`, {
        transaction_id: ID,
        decision: "confirm",
      });
    }
  });

  it("posts the Finance page and reconditioning fund forms to their own routes", async () => {
    const form = new FormData();
    form.set("disbursement_id", ID);
    for (const [action, path] of [
      [finance.recordFinancialEntry, "record-entry"],
      [finance.verifyFinancialEntry, "verify-entry"],
      [finance.createDisbursementRequest, "create-disbursement"],
      [finance.requestPurchaseFunds, "request-purchase-funds"],
      [finance.recordSellerPaid, "record-seller-paid"],
      [finance.advanceDisbursement, "advance"],
      [finance.markExpenseReimbursed, "mark-expense-reimbursed"],
    ] as const) {
      await expect(action(form)).resolves.toEqual({ success: true });
      expect(api).toHaveBeenLastCalledWith("POST", `/api/v1/staff/finance/${path}`, { disbursement_id: ID });
    }
    await funds.markReconditioningRefundReturned(form);
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/reconditioning/refund-returned", {
      disbursement_id: ID,
    });
    await funds.requestReconditioningFunds(form);
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/staff/reconditioning/request-funds", expect.any(FormData));
  });

  it("returns the checkout link, or Laravel's message as { error }", async () => {
    const form = new FormData();
    form.set("transaction_id", ID);
    api.mockResolvedValue({ success: true, url: "https://pay/cs_1" });
    await expect(checkout.startOnlinePayment(form)).resolves.toEqual({ success: true, url: "https://pay/cs_1" });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/payments/checkout", { transaction_id: ID });

    api.mockRejectedValue(new ApiError(422, { code: "validation_error", message: "Nothing is due online right now." }));
    await expect(checkout.startInstallmentCheckout(form)).resolves.toEqual({
      error: "Nothing is due online right now.",
    });
    expect(api).toHaveBeenLastCalledWith("POST", "/api/v1/payments/installment-checkout", expect.any(FormData));
    expect(revalidate).toHaveBeenCalledTimes(1);
  });
});
