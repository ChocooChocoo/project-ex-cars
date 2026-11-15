import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type FieldCaseRow, FieldCasesClient } from "./field-cases-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/field-cases/actions", () => ({ updateFieldCase: vi.fn() }));
vi.mock("@/app/(staff)/transactions/actions", () => ({ assignMechanic: vi.fn(), createFieldCase: vi.fn() }));

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

const informantId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const securityId = "33333333-3333-4333-8333-333333333333";
const outsiderId = "44444444-4444-4444-8444-444444444444";

const row = (overrides: Partial<FieldCaseRow> = {}): FieldCaseRow => ({
  id: "case-1",
  case_kind: "delivery",
  state: "assigned",
  vehicle_id: null,
  location: null,
  expenses_cents: null,
  notes: null,
  completion_date: null,
  created_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

// The "N / M" badge counts the rows the quick filter kept, so it reports which filter is active.
const cases = [
  row({ id: "case-informant", assigned_confidential_informant: informantId }),
  row({ id: "case-mechanic", mechanic_id: mechanicId }),
  row({ id: "case-security", head_security_id: securityId }),
  row({ id: "case-outsider", assigned_confidential_informant: outsiderId }),
];

function renderFor(userRole: string, currentUserId: string | null) {
  render(
    <FieldCasesClient
      cases={cases}
      canUpdate={false}
      canCreate={false}
      canAssignMechanic={false}
      informants={[]}
      mechanics={[]}
      userRole={userRole}
      currentUserId={currentUserId}
    />,
  );
}

describe("FieldCasesClient default quick filter", () => {
  it("opens a field worker on their own cases", () => {
    renderFor("confidential_informant", informantId);

    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("counts a Head Security case assigned through head_security_id", () => {
    renderFor("head_security", securityId);

    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("opens an office role on every case", () => {
    renderFor("sales_manager", outsiderId);

    expect(screen.getByText("4 / 4")).toBeInTheDocument();
  });

  it("does not filter when the current user is unknown", () => {
    renderFor("mechanic", null);

    expect(screen.getByText("4 / 4")).toBeInTheDocument();
  });
});
