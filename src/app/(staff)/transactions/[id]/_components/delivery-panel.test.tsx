import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(staff)/transactions/delivery-actions", () => ({
  cancelUnpaidDelivery: vi.fn(),
  createDeliveryFieldCase: vi.fn(),
  relayDeliveryDelay: vi.fn(),
  rescheduleDelivery: vi.fn(),
  setDeliveryTerms: vi.fn(),
}));

import { DeliveryPanel } from "./delivery-panel";

const informant = { id: "11111111-1111-4111-8111-111111111111", full_name: "Informant One" };
const security = { id: "22222222-2222-4222-8222-222222222222", full_name: "Security One" };

describe("DeliveryPanel delivery team (T05)", () => {
  it("asks only for the Confidential Informant and the Head Security", () => {
    render(
      <DeliveryPanel
        transactionId="33333333-3333-4333-8333-333333333333"
        state="approved"
        purchaseDetails={{
          payment_method: "cash",
          arrangement_kind: "delivery",
          delivery_fee: 1000,
          downpayment_amount: 5000,
          downpayment_due_at: "2026-11-05T00:00:00.000Z",
        }}
        payments={[{ payment_kind: "delivery_fee", amount: 1000, verified_by: "accountant-1" }]}
        arrangement={{ schedule: "2026-11-10T02:00:00.000Z", location: "Makati" }}
        fieldCase={null}
        flowStatus={null}
        team={{ informants: [informant], headSecurity: [security] }}
        userRole="sales_manager"
      />,
    );

    expect(screen.getByText("Delivery team")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Confidential Informant" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Head Security" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Mechanic" })).not.toBeInTheDocument();
  });
});
