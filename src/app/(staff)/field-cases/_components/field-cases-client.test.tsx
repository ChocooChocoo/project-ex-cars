import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assignMechanic, createFieldCase } from "@/app/(staff)/transactions/actions";

import { type FieldCaseRow, FieldCasesClient } from "./field-cases-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/field-cases/actions", () => ({ updateFieldCase: vi.fn() }));
vi.mock("@/app/(staff)/transactions/actions", () => ({
  assignMechanic: vi.fn(),
  createFieldCase: vi.fn(),
}));

const fieldCase: FieldCaseRow = {
  id: "case-1",
  case_kind: "delivery",
  state: "assigned",
  vehicle_id: "vehicle-1",
  location: "Manila",
  expenses_cents: 120000,
  notes: "Deliver vehicle",
  completion_date: null,
  created_at: "2026-08-01T00:00:00.000Z",
};

describe("FieldCasesClient template table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assignMechanic).mockResolvedValue({ success: true });
    vi.mocked(createFieldCase).mockResolvedValue({ success: true, id: "case-1" });
  });

  it("renders template controls and keeps update actions in the row menu", async () => {
    render(
      <FieldCasesClient
        cases={[fieldCase]}
        canUpdate
        canCreate={false}
        canAssignMechanic
        informants={[]}
        mechanics={[{ id: "mechanic-1", full_name: "Mechanic One" }]}
        userRole="sales_manager"
      />,
    );

    expect(screen.getByPlaceholderText("Search field cases...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "State" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Created date" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kind" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open field case actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Assign Mechanic" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Update" })).toBeInTheDocument();
  });
});
