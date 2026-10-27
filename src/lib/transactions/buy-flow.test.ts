import { describe, expect, it } from "vitest";

import {
  activeBuyerIdCount,
  addWorkingDays,
  canRecordNoShow,
  contractReadyForSale,
  contractTemplate,
  deliveryBalanceNote,
  FINANCING_TERM_MONTHS,
  financedTotal,
  financingFullyPaid,
  isBusinessSlot,
  isDeliveryCashRequest,
  isDeliveryDate,
  isFieldArrangement,
  isFinancingRequest,
  isHalfwayCashRequest,
  isOnsiteCashRequest,
  isQueuedCashRequest,
  isQueuedRequest,
  isVisitSlot,
  MISSED_INSTALLMENTS_BEFORE_REPOSSESSION,
  missedInstallments,
  missingContractCopies,
  needsContract,
  nextDeliveryStatus,
  nextStanding,
  paidTowardPrice,
  papersReadyForSale,
  paymentAllowedBeforeSigning,
  pickedTime,
  signsInApp,
  verifiedPaid,
} from "./buy-flow";
import { canTransition } from "./state-machine";

describe("pickedTime", () => {
  it("keeps the minutes the buyer picked, so an off-the-hour time is refused instead of rounded", () => {
    expect(pickedTime("2033-03-05T10:25")).toEqual(new Date("2033-03-05T10:25"));
    expect(pickedTime("")).toBeNull();
    expect(pickedTime("not a date")).toBeNull();
  });
});

describe("paidTowardPrice", () => {
  it("leaves a payment the Head Accountant rejected out of what was paid (T03 HA3)", () => {
    expect(
      paidTowardPrice([
        { payment_kind: "downpayment", amount: 50000, rejected_at: "2026-10-26T03:00:00Z" },
        { payment_kind: "balance", amount: 20000, rejected_at: null },
      ]),
    ).toBe(20000);
  });

  it("leaves the delivery and reschedule fees out of what was paid for the car", () => {
    expect(
      paidTowardPrice([
        { payment_kind: "delivery_fee", amount: 2500 },
        { payment_kind: "downpayment", amount: 50000 },
        { payment_kind: "reschedule_fee", amount: 500 },
        { payment_kind: "balance", amount: 450000 },
        { payment_kind: null, amount: 1000 },
      ]),
    ).toBe(501000);
  });
});

describe("activeBuyerIdCount", () => {
  it("counts pending and verified IDs but not rejected ones or other papers", () => {
    expect(
      activeBuyerIdCount([
        { document_kind: "valid_id", verification_state: "pending" },
        { document_kind: "valid_id", verification_state: "verified" },
        { document_kind: "valid_id", verification_state: "rejected" },
        { document_kind: "proof_of_billing", verification_state: "verified" },
      ]),
    ).toBe(2);
  });
});

describe("isOnsiteCashRequest", () => {
  it("is Cash paid at a GCE visit only", () => {
    expect(isOnsiteCashRequest({ payment_method: "cash", arrangement_kind: "gce_visit" })).toBe(true);
    expect(isOnsiteCashRequest({ payment_method: "cash", arrangement_kind: "meetup" })).toBe(false);
    expect(isOnsiteCashRequest({ payment_method: "financing", arrangement_kind: "gce_visit" })).toBe(false);
    expect(isOnsiteCashRequest(null)).toBe(false);
  });
});

describe("§7–9 bank transfer", () => {
  it("follows the Cash flow for each arrangement", () => {
    expect(isOnsiteCashRequest({ payment_method: "bank_transfer", arrangement_kind: "gce_visit" })).toBe(true);
    expect(isHalfwayCashRequest({ payment_method: "bank_transfer", arrangement_kind: "meetup" })).toBe(true);
    expect(isDeliveryCashRequest({ payment_method: "bank_transfer", arrangement_kind: "delivery" })).toBe(true);
    expect(isQueuedRequest({ payment_method: "bank_transfer", arrangement_kind: "gce_visit" })).toBe(false);
    expect(isOnsiteCashRequest({ payment_method: "down_payment", arrangement_kind: "gce_visit" })).toBe(false);
  });

  it("treats a PayMongo full payment like Cash", () => {
    expect(isOnsiteCashRequest({ payment_method: "paymongo", arrangement_kind: "gce_visit" })).toBe(true);
    expect(isHalfwayCashRequest({ payment_method: "paymongo", arrangement_kind: "meetup" })).toBe(true);
    expect(deliveryBalanceNote("paymongo", "buyer")).toBe("The balance is paid through PayMongo on delivery.");
  });

  it("words the delivery balance by method", () => {
    expect(deliveryBalanceNote("bank_transfer", "buyer")).toBe("The balance is paid by bank transfer on delivery.");
    expect(deliveryBalanceNote("cash", "team")).toBe(
      "Collect the remaining balance in cash when the buyer accepts the car.",
    );
    expect(deliveryBalanceNote("financing", "team")).toBe(
      "Collect nothing on delivery: the balance is financed by GCE.",
    );
  });
});

describe("T04 financing", () => {
  it("adds a flat 10% to the price", () => {
    expect(financedTotal(1_000_000)).toBe(1_100_000);
    expect(financedTotal(499_999)).toBe(549_999);
    expect(financedTotal(0)).toBe(0);
  });

  it("offers 6, 12, 24, 36 and 60 months", () => {
    expect(FINANCING_TERM_MONTHS).toEqual([6, 12, 24, 36, 60]);
  });
});

// 2026-10-01 is a Thursday and 2026-10-04 a Sunday; times are Manila time.
const manila = (day: string, time: string) => new Date(`${day}T${time}:00+08:00`);

describe("isVisitSlot", () => {
  const now = manila("2026-09-30", "12:00");

  it("accepts a future whole hour", () => {
    expect(isVisitSlot(manila("2026-10-01", "10:00"), now)).toBe(true);
  });

  it("refuses past times and times off the hour", () => {
    expect(isVisitSlot(manila("2026-09-30", "11:00"), now)).toBe(false);
    expect(isVisitSlot(manila("2026-10-01", "10:30"), now)).toBe(false);
    expect(isVisitSlot(new Date("not a date"), now)).toBe(false);
  });
});

describe("isBusinessSlot", () => {
  it("accepts whole hours from 9 AM to 9 PM, Monday to Saturday", () => {
    expect(isBusinessSlot(manila("2026-10-01", "09:00"))).toBe(true);
    expect(isBusinessSlot(manila("2026-10-01", "21:00"))).toBe(true);
    expect(isBusinessSlot(manila("2026-10-03", "10:00"))).toBe(true);
  });

  it("refuses earlier, later, off-the-hour and Sunday times", () => {
    expect(isBusinessSlot(manila("2026-10-01", "08:00"))).toBe(false);
    expect(isBusinessSlot(manila("2026-10-01", "22:00"))).toBe(false);
    expect(isBusinessSlot(manila("2026-10-01", "10:30"))).toBe(false);
    expect(isBusinessSlot(manila("2026-10-04", "10:00"))).toBe(false);
  });
});

describe("isDeliveryDate", () => {
  const requested = manila("2026-10-01", "10:00");

  it("needs at least 7 days after the request date", () => {
    expect(isDeliveryDate(manila("2026-10-07", "10:00"), requested)).toBe(false);
    expect(isDeliveryDate(manila("2026-10-08", "10:00"), requested)).toBe(true);
  });
});

describe("buyer request approval (Q0a)", () => {
  it("lets the Sales Manager approve or reject, with the CEO as override", () => {
    for (const role of ["sales_manager", "ceo"]) {
      expect(canTransition("under_review", "approved", role)).toBe(true);
      expect(canTransition("under_review", "rejected", role)).toBe(true);
    }
    expect(canTransition("under_review", "approved", "head_accountant")).toBe(false);
    expect(canTransition("under_review", "approved", "account_manager")).toBe(false);
  });
});

describe("isHalfwayCashRequest", () => {
  it("is Cash at a Calabarzon meet-up only", () => {
    expect(isHalfwayCashRequest({ payment_method: "cash", arrangement_kind: "meetup" })).toBe(true);
    expect(isHalfwayCashRequest({ payment_method: "cash", arrangement_kind: "gce_visit" })).toBe(false);
  });
});

describe("canRecordNoShow", () => {
  const schedule = new Date("2026-10-01T10:00:00Z");

  it("waits 2 hours 30 minutes after the meet-up time", () => {
    expect(canRecordNoShow(schedule, new Date("2026-10-01T12:29:59Z"))).toBe(false);
    expect(canRecordNoShow(schedule, new Date("2026-10-01T12:30:00Z"))).toBe(true);
  });
});

describe("nextStanding", () => {
  it("restricts a buyer to GCE Visit only on the second no-show", () => {
    const first = nextStanding(null, "no_show");
    expect(first).toEqual({ no_show_count: 1, strike_count: 0, gce_visit_only: false });
    expect(nextStanding(first, "no_show")).toEqual({ no_show_count: 2, strike_count: 0, gce_visit_only: true });
  });

  it("restricts a buyer immediately on a Not Legit decline", () => {
    expect(nextStanding(null, "strike")).toEqual({ no_show_count: 0, strike_count: 1, gce_visit_only: true });
  });
});

describe("delivery rules", () => {
  it("queues Meet Halfway and Delivery Cash requests, not GCE visits", () => {
    expect(isQueuedCashRequest({ payment_method: "cash", arrangement_kind: "delivery" })).toBe(true);
    expect(isQueuedCashRequest({ payment_method: "cash", arrangement_kind: "meetup" })).toBe(true);
    expect(isQueuedCashRequest({ payment_method: "cash", arrangement_kind: "gce_visit" })).toBe(false);
    expect(isDeliveryCashRequest({ payment_method: "financing", arrangement_kind: "delivery" })).toBe(false);
  });

  it("counts the downpayment deadline in working days", () => {
    // Thursday 2026-10-01 + 3 working days skips the weekend: Tuesday 2026-10-06.
    expect(addWorkingDays(new Date(2026, 9, 1, 12), 3)).toEqual(new Date(2026, 9, 6, 12));
    // Friday + 1 working day is Monday.
    expect(addWorkingDays(new Date(2026, 9, 2, 12), 1)).toEqual(new Date(2026, 9, 5, 12));
  });

  it("moves delivery tracking forward one step at a time", () => {
    expect(nextDeliveryStatus(null)).toBe("dispatched");
    expect(nextDeliveryStatus("dispatched")).toBe("in_transit");
    expect(nextDeliveryStatus("arriving")).toBe("delivered");
    expect(nextDeliveryStatus("delivered")).toBeNull();
  });

  it("counts only verified payments of the asked kind", () => {
    const payments = [
      { payment_kind: "delivery_fee", amount: 1500, verified_by: "ha" },
      { payment_kind: "downpayment", amount: 50000, verified_by: null },
      { payment_kind: "downpayment", amount: 20000, verified_by: "ha" },
    ];
    expect(verifiedPaid(payments, "delivery_fee")).toBe(1500);
    expect(verifiedPaid(payments, "downpayment")).toBe(20000);
  });
});

describe("financing rules", () => {
  it("queues a financing request that inspects at a GCE visit", () => {
    expect(isQueuedRequest({ payment_method: "financing", arrangement_kind: "gce_visit" })).toBe(true);
    expect(isQueuedRequest({ payment_method: "cash", arrangement_kind: "gce_visit" })).toBe(false);
  });

  it("accepts a GCE visit, a meet-up (§10) or a delivery (§11) for financing", () => {
    for (const arrangement_kind of ["gce_visit", "meetup", "delivery"]) {
      expect(isFinancingRequest({ payment_method: "financing", arrangement_kind })).toBe(true);
      expect(isQueuedRequest({ payment_method: "financing", arrangement_kind })).toBe(true);
    }
    expect(isFinancingRequest({ payment_method: "financing", arrangement_kind: null })).toBe(false);
    expect(isFinancingRequest({ payment_method: "cash", arrangement_kind: "delivery" })).toBe(false);
  });

  it("counts unpaid installments past their due date as missed", () => {
    const today = new Date("2026-10-15T12:00:00Z");
    const installments = [
      { state: "paid", due_date: "2026-07-01" },
      { state: "overdue", due_date: "2026-08-01" },
      { state: "upcoming", due_date: "2026-09-01" },
      { state: "waived", due_date: "2026-09-15" },
      { state: "upcoming", due_date: "2026-10-15" },
      { state: "upcoming", due_date: "2026-11-01" },
    ];
    expect(missedInstallments(installments, today)).toBe(2);
    expect(MISSED_INSTALLMENTS_BEFORE_REPOSSESSION).toBe(4);
  });

  it("is fully paid only when every installment is paid or waived", () => {
    expect(
      financingFullyPaid([
        { state: "paid", due_date: "x" },
        { state: "waived", due_date: "y" },
      ]),
    ).toBe(true);
    expect(
      financingFullyPaid([
        { state: "paid", due_date: "x" },
        { state: "due", due_date: "y" },
      ]),
    ).toBe(false);
    expect(financingFullyPaid([])).toBe(false);
  });
});

describe("vehicle papers custody", () => {
  it("treats a meet-up and a delivery as field arrangements", () => {
    expect(isFieldArrangement({ arrangement_kind: "meetup" })).toBe(true);
    expect(isFieldArrangement({ arrangement_kind: "delivery" })).toBe(true);
    expect(isFieldArrangement({ arrangement_kind: "gce_visit" })).toBe(false);
    expect(isFieldArrangement(null)).toBe(false);
  });

  it("lets a GCE visit sale close only once the Sales Manager has received the papers", () => {
    const visit = { arrangement_kind: "gce_visit" };
    expect(papersReadyForSale(visit, null)).toBe(false);
    expect(papersReadyForSale(visit, { papers_status: "requested" })).toBe(false);
    expect(papersReadyForSale(visit, { papers_status: "handed_over" })).toBe(false);
    expect(papersReadyForSale(visit, { papers_status: "received" })).toBe(true);
  });

  it("lets a meet-up or delivery sale close only once the CI has handed the papers to the buyer", () => {
    for (const arrangement_kind of ["meetup", "delivery"]) {
      expect(papersReadyForSale({ arrangement_kind }, { papers_status: "released_to_ci" })).toBe(false);
      expect(papersReadyForSale({ arrangement_kind }, { papers_status: "returned" })).toBe(false);
      expect(papersReadyForSale({ arrangement_kind }, { papers_status: "handed_over" })).toBe(true);
    }
  });
});

describe("contract", () => {
  const cashVisit = { payment_method: "cash", arrangement_kind: "gce_visit" };
  const cashMeetup = { payment_method: "cash", arrangement_kind: "meetup" };
  const cashDelivery = { payment_method: "cash", arrangement_kind: "delivery" };
  const financedVisit = { payment_method: "financing", arrangement_kind: "gce_visit" };
  const financedMeetup = { payment_method: "financing", arrangement_kind: "meetup" };
  const financedDelivery = { payment_method: "financing", arrangement_kind: "delivery" };
  const at = "2026-10-14T02:00:00.000Z";

  it("is needed for a meet-up, a delivery and every financed sale, not for cash at a GCE visit", () => {
    for (const details of [cashMeetup, cashDelivery, financedVisit, financedMeetup, financedDelivery]) {
      expect(needsContract(details)).toBe(true);
    }
    expect(needsContract(cashVisit)).toBe(false);
    expect(needsContract({ payment_method: "bank_transfer", arrangement_kind: "gce_visit" })).toBe(false);
    expect(needsContract(null)).toBe(false);
  });

  it("is signed in the app for financing at a visit or a meet-up, on paper everywhere else", () => {
    expect(signsInApp(financedVisit)).toBe(true);
    expect(signsInApp(financedMeetup)).toBe(true);
    expect(signsInApp(financedDelivery)).toBe(false);
    expect(signsInApp(cashMeetup)).toBe(false);
    expect(signsInApp(cashDelivery)).toBe(false);
  });

  it("names who has not recorded keeping the signed copy", () => {
    expect(missingContractCopies(cashMeetup, null)).toEqual(["Confidential Informant", "Mechanic"]);
    expect(missingContractCopies(cashMeetup, { ci_copy_at: at })).toEqual(["Mechanic"]);
    expect(missingContractCopies(cashMeetup, { mechanic_copy_at: at })).toEqual(["Confidential Informant"]);
    expect(missingContractCopies(cashMeetup, { ci_copy_at: at, mechanic_copy_at: at })).toEqual([]);
    expect(missingContractCopies(cashDelivery, { ci_copy_at: at })).toEqual([]);
    expect(missingContractCopies(financedMeetup, { ci_copy_at: at })).toEqual([]);
    expect(missingContractCopies(financedVisit, null)).toEqual([]);
  });

  it("lets a sale close only once the contract is signed and every copy is kept", () => {
    expect(contractReadyForSale(cashVisit, null)).toBe(true);
    expect(contractReadyForSale(financedVisit, null)).toBe(false);
    expect(contractReadyForSale(financedVisit, { contract_state: "approved" })).toBe(false);
    expect(contractReadyForSale(financedVisit, { contract_state: "signed" })).toBe(true);
    expect(contractReadyForSale(cashDelivery, { contract_state: "signed" })).toBe(false);
    expect(contractReadyForSale(cashDelivery, { contract_state: "signed", ci_copy_at: at })).toBe(true);
    expect(contractReadyForSale(cashMeetup, { contract_state: "signed", ci_copy_at: at })).toBe(false);
    expect(contractReadyForSale(cashMeetup, { contract_state: "signed", ci_copy_at: at, mechanic_copy_at: at })).toBe(
      true,
    );
    expect(contractReadyForSale(cashMeetup, { ci_copy_at: at, mechanic_copy_at: at })).toBe(false);
  });

  it("allows only the delivery fee, the reschedule fee and the downpayment of a delivery before signing", () => {
    for (const kind of ["delivery_fee", "reschedule_fee", "downpayment"]) {
      expect(paymentAllowedBeforeSigning(cashDelivery, kind)).toBe(true);
      expect(paymentAllowedBeforeSigning(financedDelivery, kind)).toBe(true);
    }
    expect(paymentAllowedBeforeSigning(cashDelivery, "balance")).toBe(false);
    expect(paymentAllowedBeforeSigning(cashDelivery, null)).toBe(false);
    expect(paymentAllowedBeforeSigning(financedVisit, "downpayment")).toBe(false);
    expect(paymentAllowedBeforeSigning(cashMeetup, "downpayment")).toBe(false);
  });

  it("prefills the template from the financing terms", () => {
    const text = contractTemplate({
      buyer: "Maria Santos",
      vehicle: "2020 Toyota Vios (GCE-001)",
      price: 500000,
      terms: {
        down_payment: 100000,
        number_of_payments: 24,
        payment_frequency: "monthly",
        first_due_date: "2026-11-15",
      },
    });
    expect(text).toContain("Maria Santos");
    expect(text).toContain("2020 Toyota Vios (GCE-001)");
    expect(text).toContain("500,000");
    expect(text).toContain("100,000");
    expect(text).toContain("24 monthly payments");
    expect(text).toContain("2026-11-15");
    expect(text).toMatch(/take back the vehicle/i);
  });
});
