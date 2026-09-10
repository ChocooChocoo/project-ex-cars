import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FieldCasesClient } from "./field-cases-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/field-cases/actions", () => ({ updateFieldCase: vi.fn() }));
vi.mock("@/app/(staff)/transactions/actions", () => ({
  assignMechanic: vi.fn(),
  createFieldCase: vi.fn().mockResolvedValue({ success: true, id: "case-1" }),
}));

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

const uuid = (n: number) => `${`${n}`.padStart(8, "0")}-1111-4111-8111-111111111111`;

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: "Create Field Case" }));
  return screen.getByRole("dialog");
}

describe("Task 33 Create Field Case interaction", () => {
  it("exposes explicit names for case kind and worker type selectors", () => {
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[{ id: uuid(1), full_name: "Informant" }]}
        mechanics={[]}
        userRole="confidential_informant"
      />,
    );

    const dialog = openModal();
    expect(within(dialog).getByRole("combobox", { name: "Select case kind" })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Select worker type" })).toBeInTheDocument();
  });

  it("keeps the dialog open after selecting transaction and vehicle options", async () => {
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[{ id: uuid(1), full_name: "Informant" }]}
        mechanics={[]}
        userRole="confidential_informant"
        transactions={[{ id: uuid(2), transaction_kind: "buy", current_state: "under_review" }]}
        vehicles={[{ id: uuid(3), make: "Toyota", model: "Vios", year: 2025, stock_code: "GCE-3" }]}
      />,
    );

    const dialog = openModal();
    const transactionTrigger = within(dialog).getByRole("combobox", { name: "Select transaction" });
    fireEvent.click(transactionTrigger);
    fireEvent.click(await screen.findByRole("option", { name: /Buy.*Under Review/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const vehicleTrigger = within(screen.getByRole("dialog")).getByRole("combobox", { name: "Select vehicle" });
    fireEvent.click(vehicleTrigger);
    fireEvent.click(await screen.findByRole("option", { name: /Toyota Vios/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("caps long transaction and vehicle option lists", async () => {
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[]}
        mechanics={[]}
        userRole="confidential_informant"
        transactions={Array.from({ length: 25 }, (_, index) => ({
          id: uuid(index + 10),
          transaction_kind: "buy",
          current_state: "pending",
        }))}
        vehicles={Array.from({ length: 25 }, (_, index) => ({
          id: uuid(index + 50),
          make: "Toyota",
          model: `Vios ${index}`,
          year: 2020,
          stock_code: `GCE-${index}`,
        }))}
      />,
    );

    const dialog = openModal();
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Select transaction" }));
    const transactionList = await screen.findByRole("listbox");
    expect(transactionList.className).toContain("max-h-64");
    fireEvent.keyDown(transactionList, { key: "Escape" });

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("combobox", { name: "Select vehicle" }));
    const vehicleList = await screen.findByRole("listbox");
    expect(vehicleList.className).toContain("max-h-64");
  });
});
