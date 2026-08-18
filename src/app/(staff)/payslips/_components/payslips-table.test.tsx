import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PayslipsTable, type PayslipTableRow } from "./payslips-table";

const payslip: PayslipTableRow = {
  id: "payslip-1",
  period_start: "2026-08-01",
  period_end: "2026-08-15",
  gross_cents: 500000,
  net_cents: 450000,
  status: "finalized",
  payment_status: "pending",
};

describe("PayslipsTable", () => {
  it("renders template controls and keeps View in the row menu", async () => {
    render(<PayslipsTable data={[payslip]} />);

    expect(screen.getByPlaceholderText("Search payslips...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Period" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Payment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open payslip actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "View" })).toBeInTheDocument();
  });
});
