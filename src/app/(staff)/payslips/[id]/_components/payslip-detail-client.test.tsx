import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { addPayslipItem } from "@/app/(staff)/payroll/actions";

import { PayslipDetailClient } from "./payslip-detail-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/payroll/actions", () => ({
  addPayslipItem: vi.fn().mockResolvedValue({ success: true }),
  markPayslipPaid: vi.fn(),
}));

describe("PayslipDetailClient Add Item", () => {
  it("sends the peso amount as centavos", async () => {
    render(
      <PayslipDetailClient
        payslipId="11111111-1111-4111-8111-111111111111"
        status="draft"
        paymentStatus="pending"
        grossCents={669871}
        deductionsCents={9999}
        netCents={659872}
        earnings={[]}
        deductions={[]}
        hours={null}
        canEdit
        canPay={false}
        periodLabel="7/20/2026 — 8/7/2026"
        employeeLabel="Carlos Mendoza"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("SSS, PhilHealth, Overtime..."), {
      target: { value: "Cash advance" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("0.00"), { target: { value: "500" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Item" }));

    await vi.waitFor(() => expect(addPayslipItem).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(addPayslipItem).mock.calls[0]?.[0] as FormData;
    expect(formData.get("amount_cents")).toBe("50000");
  });
});
