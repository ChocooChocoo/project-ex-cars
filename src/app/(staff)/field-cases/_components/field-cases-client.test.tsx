import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assignMechanic, createFieldCase } from "@/app/(staff)/transactions/actions";

import { type FieldCaseRow, FieldCasesClient } from "./field-cases-client";

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

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

  it("hides Assign Mechanic when canAssignMechanic is false", async () => {
    render(
      <FieldCasesClient
        cases={[fieldCase]}
        canUpdate
        canCreate={false}
        canAssignMechanic={false}
        informants={[]}
        mechanics={[{ id: "mechanic-1", full_name: "Mechanic One" }]}
        userRole="sales_manager"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Open field case actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Assign Mechanic" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Update" })).toBeInTheDocument();
  });
});

describe("FieldCasesClient create modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assignMechanic).mockResolvedValue({ success: true });
    vi.mocked(createFieldCase).mockResolvedValue({ success: true, id: "case-1" });
  });

  function openCreateModal() {
    fireEvent.click(screen.getByRole("button", { name: "Create Field Case" }));
    return screen.findByRole("button", { name: "Create" });
  }

  it("blocks create with an inline error when neither transaction nor vehicle is linked", async () => {
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[]}
        mechanics={[]}
        userRole="confidential_informant"
      />,
    );

    const createButton = await openCreateModal();
    expect(screen.getByText("Transaction (at least one link required)")).toBeInTheDocument();
    expect(screen.getByText("Vehicle (at least one link required)")).toBeInTheDocument();
    fireEvent.click(createButton);

    expect(await screen.findByText("Select a transaction or a vehicle to link this field case.")).toBeInTheDocument();
    expect(createFieldCase).not.toHaveBeenCalled();
  });

  it("blocks create with an inline error when no worker is assigned", async () => {
    const vehicleId = "11111111-1111-4111-8111-111111111111";
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[{ id: "informant-1", full_name: "Informant One" }]}
        mechanics={[]}
        userRole="confidential_informant"
        transactions={[]}
        vehicles={[{ id: vehicleId, make: "Toyota", model: "Camry", year: 2024, stock_code: "STK-001" }]}
      />,
    );

    await openCreateModal();
    const vehicleTrigger = await screen.findByRole("combobox", { name: "Select vehicle" });
    fireEvent.pointerDown(vehicleTrigger);
    fireEvent.click(vehicleTrigger);
    fireEvent.click(await screen.findByRole("option", { name: /Toyota Camry/ }));

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Assign an informant or a mechanic to this field case.")).toBeInTheDocument();
    expect(createFieldCase).not.toHaveBeenCalled();
  });

  it("calls createFieldCase once a link and worker are both set", async () => {
    const vehicleId = "11111111-1111-4111-8111-111111111111";
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[{ id: "informant-1", full_name: "Informant One" }]}
        mechanics={[]}
        userRole="confidential_informant"
        transactions={[]}
        vehicles={[{ id: vehicleId, make: "Toyota", model: "Camry", year: 2024, stock_code: "STK-001" }]}
      />,
    );

    await openCreateModal();
    const vehicleTrigger = await screen.findByRole("combobox", { name: "Select vehicle" });
    fireEvent.pointerDown(vehicleTrigger);
    fireEvent.click(vehicleTrigger);
    fireEvent.click(await screen.findByRole("option", { name: /Toyota Camry/ }));
    const workerTrigger = await screen.findByRole("combobox", { name: "Select worker" });
    fireEvent.pointerDown(workerTrigger);
    fireEvent.click(workerTrigger);
    fireEvent.click(await screen.findByRole("option", { name: "Informant One" }));

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await vi.waitFor(() => expect(createFieldCase).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(createFieldCase).mock.calls[0]?.[0] as FormData;
    expect(formData.get("vehicle_id")).toBe(vehicleId);
    expect(formData.get("assigned_confidential_informant")).toBe("informant-1");
  });
});
