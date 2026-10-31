import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approvePapersRelease,
  handPapersToBuyer,
  releasePapersToCi,
} from "@/app/(staff)/transactions/handover-actions";

import { type VehiclePaperRow, VehiclePapersTable } from "./vehicle-papers-table";

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/transactions/handover-actions", () => ({
  approvePapersRelease: vi.fn(),
  handPapersToBuyer: vi.fn(),
  releasePapersToCi: vi.fn(),
}));

const row: VehiclePaperRow = {
  transactionId: "tx-1",
  vehicle: "2022 Toyota Vios (STK-1)",
  buyer: "Maria Santos",
  status: "requested",
  arrangementKind: "gce_visit",
  updatedAt: "2026-10-20T08:00:00.000Z",
  orcrUrl: "https://example.test/orcr.pdf",
};

function openRowMenu() {
  const trigger = screen.getByRole("button", { name: "Actions for 2022 Toyota Vios (STK-1)" });
  fireEvent.pointerDown(trigger);
  fireEvent.mouseDown(trigger, { button: 0 });
  fireEvent.mouseUp(trigger, { button: 0 });
  fireEvent.click(trigger);
  return screen.getByRole("menu");
}

describe("VehiclePapersTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(approvePapersRelease).mockResolvedValue({ success: true });
    vi.mocked(handPapersToBuyer).mockResolvedValue({ success: true });
    vi.mocked(releasePapersToCi).mockResolvedValue({ success: true });
  });

  it("offers the papers, the two prints and Mark Released on the row menu", () => {
    render(<VehiclePapersTable rows={[row]} canRelease />);

    expect(screen.getByRole("columnheader", { name: "Vehicle" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Buyer" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("Papers Requested")).toBeInTheDocument();

    const menu = openRowMenu();
    expect(within(menu).getByRole("menuitem", { name: "View papers" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Print Deed of Sale" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Print Policy & Warranty" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Mark Released" })).toBeInTheDocument();
  });

  it("releases the papers for the CI and keeps the action away from the CEO", () => {
    const { rerender } = render(<VehiclePapersTable rows={[row]} canRelease />);
    expect(within(openRowMenu()).getByRole("menuitem", { name: "Mark Released" })).toBeInTheDocument();

    rerender(<VehiclePapersTable rows={[row]} canRelease={false} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    const menu = openRowMenu();
    expect(within(menu).queryByRole("menuitem", { name: "Mark Released" })).not.toBeInTheDocument();
  });

  it("shows the OR/CR, the physical-copy note and the two print links in View papers", () => {
    render(<VehiclePapersTable rows={[row]} canRelease />);
    fireEvent.click(within(openRowMenu()).getByRole("menuitem", { name: "View papers" }));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Vehicle papers" })).toBeInTheDocument();
    expect(within(sheet).getByText("Original OR/CR — hand over the physical copy.")).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "View OR/CR" })).toHaveAttribute(
      "href",
      "https://example.test/orcr.pdf",
    );
    const hrefs = within(sheet)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/vehicle-papers/tx-1/deed-of-sale");
    expect(hrefs).toContain("/vehicle-papers/tx-1/policy-warranty");
  });

  it("tells the CI what to do when no papers are requested", () => {
    render(<VehiclePapersTable rows={[]} canRelease />);
    expect(screen.getByText("No paper requests yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
