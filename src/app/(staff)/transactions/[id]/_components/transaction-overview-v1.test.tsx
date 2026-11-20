import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/maps/lazy-maps", () => ({
  MeetupMap: () => <div data-testid="meetup-map" />,
  GceLocationMap: () => <div data-testid="gce-map" />,
}));

import { paymentSummary, TransactionOverviewV1 } from "./transaction-overview-v1";

describe("TransactionOverviewV1 payment tiles (BH-7)", () => {
  it("shows Full Payment and Bank Transfer as two separate facts", () => {
    render(
      <TransactionOverviewV1
        id="11111111-1111-4111-8111-111111111111"
        kind="buy"
        state="under_review"
        vehicles={{ make: "Toyota", model: "Vios", year: 2021, stock_code: "GCE-1" }}
        purchaseDetails={{ final_price: 600000, payment_option: "full", payment_method: "bank_transfer" }}
        sellDetails={undefined}
        customerName="Ana Reyes"
        openedAt="2026-11-01T00:00:00.000Z"
        completedAt={null}
      />,
    );

    expect(screen.getByText("Payment option").nextElementSibling).toHaveTextContent("Full Payment");
    expect(screen.getByText("Payment method").nextElementSibling).toHaveTextContent("Bank Transfer (via PayMongo)");
  });

  it("shows the financing method and term for a financing buy", () => {
    render(
      <TransactionOverviewV1
        id="22222222-2222-4222-8222-222222222222"
        kind="buy"
        state="under_review"
        vehicles={{ make: "Honda", model: "City", year: 2022 }}
        purchaseDetails={{
          final_price: 700000,
          payment_option: "financing",
          payment_method: "financing",
          financing_pay_method: "paymongo",
          requested_term_months: 24,
        }}
        sellDetails={undefined}
        customerName="Ben Cruz"
        openedAt="2026-11-01T00:00:00.000Z"
        completedAt={null}
      />,
    );

    expect(screen.getByText("Payment option").nextElementSibling).toHaveTextContent("Financing");
    expect(screen.getByText("Payment method").nextElementSibling).toHaveTextContent("PayMongo, 24 months");
  });
});

describe("paymentSummary (BH-7)", () => {
  it("reads a full cash payment", () => {
    expect(paymentSummary({ payment_option: "full", payment_method: "cash" })).toEqual({
      option: "Full Payment",
      method: "Cash",
    });
  });

  it("keeps an older row readable when only the method was stored", () => {
    expect(paymentSummary({ payment_method: "bank_transfer" }).option).toBe("Full Payment");
    expect(paymentSummary({ payment_method: "financing" }).option).toBe("Financing");
  });

  it("defaults the financing method to PayMongo and states the term it knows", () => {
    expect(paymentSummary({ payment_option: "financing", requested_term_months: 12 })).toEqual({
      option: "Financing",
      method: "PayMongo, 12 months",
    });
    expect(paymentSummary({ payment_option: "financing" }).method).toBe("PayMongo");
    expect(paymentSummary({ payment_option: "financing", financing_pay_method: "cash" }).method).toBe("Cash");
  });

  it("shows a dash for a request with no method yet", () => {
    expect(paymentSummary({ payment_option: "full" }).method).toBe("—");
  });
});
