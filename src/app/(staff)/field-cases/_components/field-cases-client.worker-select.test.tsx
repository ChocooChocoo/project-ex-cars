import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FieldCasesClient, isSelectInteraction } from "./field-cases-client";

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

function openCreateDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Create Field Case" }));
  return screen.getByRole("dialog");
}

// Radix Dialog treats a pointerdown landing on the overlay as an outside interaction.
// While a Select is open Radix sets pointer-events: none on the rest of the page, so a
// click aimed at a dialog control lands on the overlay instead. jsdom performs no hit
// testing, so the guard itself is asserted here and the real click is covered by
// src/tests/e2e/field-case-create-dialog.spec.ts.
function pointerDownOnOverlay() {
  const overlay = document.querySelector('[data-slot="dialog-overlay"]');
  if (!overlay) throw new Error("dialog overlay not found");
  fireEvent.pointerDown(overlay, { button: 0 });
}

describe("Create Field Case worker selector", () => {
  it("treats the overlay as inside the dialog while a select is open", async () => {
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[{ id: uuid(1), full_name: "Informant One" }]}
        mechanics={[]}
        userRole="confidential_informant"
        transactions={[{ id: uuid(2), transaction_kind: "buy", current_state: "approved" }]}
      />,
    );

    const dialog = openCreateDialog();
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();

    // Closed select and no recent select interaction: an overlay hit is a genuine
    // outside interaction and must still dismiss the dialog.
    expect(isSelectInteraction(overlay)).toBe(false);
    expect(isSelectInteraction(overlay, false)).toBe(false);

    fireEvent.click(within(dialog).getByRole("combobox", { name: "Select transaction" }));
    expect(await screen.findByRole("option", { name: /Buy/ })).toBeInTheDocument();

    // Open select: the click can only have landed there because Radix disabled the
    // rest of the page, so the dialog must survive it.
    expect(isSelectInteraction(overlay)).toBe(true);
    pointerDownOnOverlay();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("still treats the overlay as outside once the select has already closed", () => {
    // Radix closes the select with flushSync on pointerdown, so by the time the
    // dialog's handler runs the DOM shows no open select. The capture-phase sample
    // is what keeps the dialog open; without it the dialog dismissed itself.
    const overlay = document.createElement("div");

    expect(isSelectInteraction(overlay, false)).toBe(false);
    expect(isSelectInteraction(overlay, true)).toBe(true);
  });

  it("keeps the dialog open after a worker is selected", async () => {
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[{ id: uuid(1), full_name: "Informant One" }]}
        mechanics={[]}
        userRole="confidential_informant"
        transactions={[]}
        vehicles={[{ id: uuid(3), make: "Toyota", model: "Vios", year: 2025, stock_code: "GCE-3" }]}
      />,
    );

    const dialog = openCreateDialog();
    const worker = within(dialog).getByRole("combobox", { name: "Select worker" });
    expect(worker).toBeEnabled();
    fireEvent.click(worker);
    fireEvent.click(await screen.findByRole("option", { name: "Informant One" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("combobox", { name: "Select worker" })).toHaveTextContent(
      "Informant One",
    );
  });

  it("disables the worker selector and explains when no worker of that kind exists", () => {
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[]}
        mechanics={[]}
        userRole="confidential_informant"
        transactions={[{ id: uuid(2), transaction_kind: "buy", current_state: "approved" }]}
      />,
    );

    const dialog = openCreateDialog();
    expect(within(dialog).getByRole("combobox", { name: "Select worker" })).toBeDisabled();
    expect(within(dialog).getByText(/no active confidential informants/i)).toBeInTheDocument();
  });

  it("keeps the worker selector enabled when only the other worker kind has members", async () => {
    render(
      <FieldCasesClient
        cases={[]}
        canUpdate
        canCreate
        canAssignMechanic
        informants={[]}
        mechanics={[{ id: uuid(4), full_name: "Mechanic One" }]}
        userRole="ceo"
        transactions={[]}
      />,
    );

    const dialog = openCreateDialog();
    expect(within(dialog).getByRole("combobox", { name: "Select worker" })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("combobox", { name: "Select worker type" }));
    fireEvent.click(await screen.findByRole("option", { name: "Mechanic" }));

    expect(within(screen.getByRole("dialog")).getByRole("combobox", { name: "Select worker" })).toBeEnabled();
  });
});
