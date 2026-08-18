import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type ReportRow, ReportsClient } from "./reports-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/reports/actions", () => ({ reviewReport: vi.fn(), submitReport: vi.fn() }));

const report: ReportRow = {
  id: "report-1",
  title: "Revenue Summary",
  report_kind: "revenue",
  description: null,
  status: "submitted",
  period_start: "2026-08-01",
  period_end: "2026-08-15",
  created_at: "2026-08-16T00:00:00.000Z",
};

describe("ReportsClient template table", () => {
  it("renders template controls and keeps review in the row menu", async () => {
    render(<ReportsClient reports={[report]} canCreate={false} canReview />);

    expect(screen.getByPlaceholderText("Search reports...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Period" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kind" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open report actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Mark Reviewed" })).toBeInTheDocument();
  });
});
