import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeDutyCheck, startDutyCheck, uploadDutyEvidence } from "@/app/(staff)/security-duty-checks/actions";

import { type DutyCheckRow, SecurityDutyChecksClient } from "./security-duty-checks-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/app/(staff)/security-duty-checks/actions", () => ({
  completeDutyCheck: vi.fn(),
  startDutyCheck: vi.fn(),
  uploadDutyEvidence: vi.fn(),
}));

const completeDutyCheckMock = vi.mocked(completeDutyCheck);
const startDutyCheckMock = vi.mocked(startDutyCheck);
const uploadDutyEvidenceMock = vi.mocked(uploadDutyEvidence);

const checks: DutyCheckRow[] = [
  {
    id: "check-1",
    duty_date: "2026-08-09",
    before_image_path: "head-security/check-1-before.jpg",
    after_image_path: null,
    notes: "Gate inspection",
    status: "in_progress",
    completed_at: null,
  },
  {
    id: "check-2",
    duty_date: "2026-08-08",
    before_image_path: "head-security/check-2-before.jpg",
    after_image_path: "head-security/check-2-after.jpg",
    notes: null,
    status: "completed",
    completed_at: "2026-08-08T18:00:00.000Z",
  },
];

function renderChecks(overrides: Partial<React.ComponentProps<typeof SecurityDutyChecksClient>> = {}) {
  return render(<SecurityDutyChecksClient checks={checks} canManage {...overrides} />);
}

describe("SecurityDutyChecksClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeDutyCheckMock.mockResolvedValue({ success: true });
    startDutyCheckMock.mockResolvedValue({ success: true });
    uploadDutyEvidenceMock.mockResolvedValue({ success: true });
  });

  it("defaults to the reusable table view with ten rows per page", () => {
    renderChecks();

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("id", "security-duty-checks-rows-per-page");
    expect(screen.getByRole("combobox")).toHaveTextContent("10");
  });

  it("switches views through an accessible single-select ToggleGroup", () => {
    renderChecks();

    const viewGroup = screen.getByRole("radiogroup", { name: "Duty check view" });
    const tableView = within(viewGroup).getByRole("radio", { name: "Table" });
    const listView = within(viewGroup).getByRole("radio", { name: "List" });
    const gridView = within(viewGroup).getByRole("radio", { name: "Grid" });

    expect(tableView).toHaveAttribute("aria-checked", "true");
    fireEvent.click(listView);
    expect(listView).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();

    fireEvent.click(gridView);
    expect(gridView).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("duty-check-grid")).toBeInTheDocument();
  });

  it("keeps the same ordered checks in table, list, and grid views", () => {
    renderChecks();
    const dateLabels = ["8/9/2026", "8/8/2026"];

    expect(
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getByText(/2026|8\//).textContent),
    ).toEqual(dateLabels);

    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect(
      screen.getAllByTestId("duty-check-item").map((item) => within(item).getByTestId("duty-check-date").textContent),
    ).toEqual(dateLabels);

    fireEvent.click(screen.getByRole("radio", { name: "Grid" }));
    expect(
      screen.getAllByTestId("duty-check-card").map((card) => within(card).getByTestId("duty-check-date").textContent),
    ).toEqual(dateLabels);
  });

  it("uploads the selected file with the exact row id and evidence slot", async () => {
    renderChecks();
    fireEvent.click(screen.getByRole("radio", { name: "List" }));

    const afterInput = screen.getByLabelText(/Upload after evidence for duty check 2026-08-09 \(check-1\)/);
    const file = new File(["after"], "after.png", { type: "image/png" });
    fireEvent.change(afterInput, { target: { files: [file] } });

    await waitFor(() => expect(uploadDutyEvidenceMock).toHaveBeenCalledTimes(1));
    const formData = uploadDutyEvidenceMock.mock.calls[0]?.[0];
    expect(formData?.get("duty_check_id")).toBe("check-1");
    expect(formData?.get("slot")).toBe("after");
    expect(formData?.get("image")).toBe(file);
  });

  it("gates completion until both evidence slots are uploaded", () => {
    renderChecks();
    const firstRow = screen.getAllByRole("row")[1];
    const completeButton = within(firstRow).getByRole("button", { name: "Complete Check" });
    expect(completeButton).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Grid" }));
    expect(
      within(screen.getAllByTestId("duty-check-card")[0]).getByRole("button", { name: "Complete Check" }),
    ).toBeDisabled();
  });

  it("shows an explicit empty state when there are no checks", () => {
    renderChecks({ checks: [] });

    expect(screen.getByText("No duty checks recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps CEO read-only without start, upload, or completion controls", () => {
    renderChecks({ canManage: false });

    expect(screen.queryByRole("button", { name: "Start Check" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload .* evidence/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete Check" })).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
