import type { ComponentProps } from "react";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type EmployeeRequestRow, EmployeeRequestsClient } from "./employee-requests-client";

const mocks = vi.hoisted(() => ({
  cancelEmployeeRequest: vi.fn(),
  prepareRequestUploads: vi.fn(),
  refresh: vi.fn(),
  reviewEmployeeRequest: vi.fn(),
  submitEmployeeRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: vi.fn() }) } }),
}));
vi.mock("@/app/(staff)/employee-requests/actions", () => ({
  cancelEmployeeRequest: mocks.cancelEmployeeRequest,
  prepareRequestUploads: mocks.prepareRequestUploads,
  reviewEmployeeRequest: mocks.reviewEmployeeRequest,
  submitEmployeeRequest: mocks.submitEmployeeRequest,
}));

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

function request(overrides: Partial<EmployeeRequestRow> = {}): EmployeeRequestRow {
  return {
    id: "request-1",
    employee_id: "employee-1",
    employee_name: "Arnel Santiago",
    request_kind: "leave",
    status: "pending",
    start_date: "2026-08-10",
    end_date: "2026-08-11",
    overtime_hours: null,
    leave_reason: "sick",
    reason: "Family event",
    review_notes: null,
    reviewed_at: null,
    employee_request_attachments: [],
    ...overrides,
  };
}

function renderRequests(options: Partial<ComponentProps<typeof EmployeeRequestsClient>> = {}) {
  return render(<EmployeeRequestsClient requests={[request()]} canReview={false} canSubmit {...options} />);
}

describe("EmployeeRequestsClient", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.prepareRequestUploads.mockReset().mockResolvedValue({ uploads: [] });
    mocks.submitEmployeeRequest.mockReset().mockResolvedValue({ success: true });
    mocks.reviewEmployeeRequest.mockReset().mockResolvedValue({ success: true });
    mocks.cancelEmployeeRequest.mockReset().mockResolvedValue({ success: true });
  });

  it("matches the template table controls with ten rows per page", () => {
    renderRequests({
      requests: Array.from({ length: 11 }, (_, index) =>
        request({ id: `request-${index + 1}`, reason: `Reason ${index + 1}` }),
      ),
    });

    expect(screen.getByPlaceholderText("Search employee requests...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start date" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument();
    expect(document.getElementById("employee-requests-rows-per-page")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(11);
  });

  it("renders every supported request kind without changing server order", () => {
    renderRequests({
      requests: [
        request({ id: "leave", request_kind: "leave" }),
        request({ id: "overtime", request_kind: "overtime" }),
        request({ id: "schedule", request_kind: "schedule_change" }),
        request({ id: "other", request_kind: "other" }),
      ],
    });

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Leave"),
      expect.stringContaining("Overtime"),
      expect.stringContaining("Schedule Change"),
      expect.stringContaining("Other"),
    ]);
  });

  it("applies unfilled Tailwind outline badge treatments for every status", () => {
    renderRequests({
      requests: [
        request({ id: "approved", status: "approved" }),
        request({ id: "rejected", status: "rejected" }),
        request({ id: "pending", status: "pending" }),
        request({ id: "cancelled", status: "cancelled" }),
      ],
    });

    const badges = ["approved", "rejected", "pending", "cancelled"].map((status) => screen.getByText(status));

    for (const badge of badges) {
      expect(badge).toHaveAttribute("data-variant", "outline");
      expect(badge.className.split(/\s+/).some((className) => className.startsWith("bg-"))).toBe(false);
    }

    expect(screen.getByText("approved")).toHaveClass("border-green-600/50", "text-green-700");
    expect(screen.getByText("rejected")).toHaveClass("border-red-600/50", "text-red-700");
    expect(screen.getByText("pending")).toHaveClass("border-yellow-600/50", "text-yellow-700");
    expect(screen.getByText("cancelled")).toHaveClass("border-slate-400/50", "text-slate-600");
  });

  it("uses the shared empty-results state when no requests are returned", () => {
    renderRequests({ requests: [] });

    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("lets reviewers open a pending request and approve it", async () => {
    renderRequests({ canReview: true, requests: [request({ id: "review-target" })] });

    const reviewTrigger = screen.getByRole("button", { name: "Open request actions" });
    expect(reviewTrigger).not.toHaveTextContent("Review");
    fireEvent.pointerDown(reviewTrigger);
    fireEvent.mouseDown(reviewTrigger, { button: 0 });
    fireEvent.mouseUp(reviewTrigger, { button: 0 });
    fireEvent.click(reviewTrigger);
    const reviewMenu = screen.getByRole("menu");
    expect(reviewMenu).toHaveClass("w-48");
    fireEvent.click(within(reviewMenu).getByRole("menuitem", { name: "Review request" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Review request")).toBeInTheDocument();

    await within(dialog).getByRole("button", { name: "Approve" }).click();

    await waitFor(() => expect(mocks.reviewEmployeeRequest).toHaveBeenCalledTimes(1));
    const submitted = mocks.reviewEmployeeRequest.mock.calls[0]?.[0] as FormData;
    expect(submitted.get("request_id")).toBe("review-target");
    expect(submitted.get("decision")).toBe("approved");
  });

  it("keeps row actions in the template ellipsis menu", async () => {
    renderRequests({ requests: [request({ id: "cancel-target" })] });

    const trigger = screen.getByRole("button", { name: "Open request actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Cancel request" })).toBeInTheDocument();
    await within(menu).getByRole("menuitem", { name: "Cancel request" }).click();

    await waitFor(() => expect(mocks.cancelEmployeeRequest).toHaveBeenCalledTimes(1));
    const submitted = mocks.cancelEmployeeRequest.mock.calls[0]?.[0] as FormData;
    expect(submitted.get("request_id")).toBe("cancel-target");
  });

  it("lets employees cancel their own pending request", async () => {
    renderRequests({ requests: [request({ id: "cancel-target" })] });

    const trigger = screen.getByRole("button", { name: "Open request actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    await within(menu).getByRole("menuitem", { name: "Cancel request" }).click();

    await waitFor(() => expect(mocks.cancelEmployeeRequest).toHaveBeenCalledTimes(1));
    const submitted = mocks.cancelEmployeeRequest.mock.calls[0]?.[0] as FormData;
    expect(submitted.get("request_id")).toBe("cancel-target");
  });

  it("shows the approved hours in place of the end date for overtime rows", () => {
    renderRequests({ requests: [request({ request_kind: "overtime", end_date: null, overtime_hours: 2 })] });

    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("2 h")).toBeInTheDocument();
    expect(within(row).queryByText("—")).not.toBeInTheDocument();
  });

  it("asks overtime for a Date and Hours only", async () => {
    renderRequests({ canSubmit: true });

    fireEvent.click(screen.getByRole("button", { name: "New Request" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Request Type" }));
    fireEvent.click(await screen.findByRole("option", { name: "Overtime" }));

    expect(within(dialog).getByLabelText("Date")).toBeInTheDocument();
    const hours = within(dialog).getByLabelText("Hours");
    expect(hours).toHaveAttribute("type", "number");
    expect(hours).toHaveAttribute("step", "0.5");
    expect(hours).toHaveAttribute("min", "0.5");
    expect(hours).toHaveAttribute("max", "12");
    expect(within(dialog).queryByLabelText("End Date")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Reason")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox", { name: "Leave reason" })).not.toBeInTheDocument();
  });

  it("submits overtime hours without an end date or reason", async () => {
    renderRequests({ canSubmit: true });

    fireEvent.click(screen.getByRole("button", { name: "New Request" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Request Type" }));
    fireEvent.click(await screen.findByRole("option", { name: "Overtime" }));
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: "2026-11-02" } });
    fireEvent.change(within(dialog).getByLabelText("Hours"), { target: { value: "2" } });

    await within(dialog).getByRole("button", { name: "Submit Request" }).click();

    await waitFor(() => expect(mocks.submitEmployeeRequest).toHaveBeenCalledTimes(1));
    const submitted = mocks.submitEmployeeRequest.mock.calls[0]?.[0] as FormData;
    expect(submitted.get("request_kind")).toBe("overtime");
    expect(submitted.get("start_date")).toBe("2026-11-02");
    expect(submitted.get("overtime_hours")).toBe("2");
    expect(submitted.get("end_date")).toBeNull();
    expect(submitted.get("reason")).toBeNull();
  });

  it("shows the leave reason dropdown and the optional proof picker", () => {
    renderRequests({ canSubmit: true });

    fireEvent.click(screen.getByRole("button", { name: "New Request" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("combobox", { name: "Leave reason" })).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Describe the reason")).not.toBeInTheDocument();

    const proofs = within(dialog).getByLabelText(/Proof files/);
    expect(proofs).toHaveAttribute("type", "file");
    expect(proofs).toHaveAttribute("multiple");
    expect(proofs.getAttribute("accept")).toContain("application/pdf");
  });

  it("keeps at most three proof files", () => {
    renderRequests({ canSubmit: true });

    fireEvent.click(screen.getByRole("button", { name: "New Request" }));
    const dialog = screen.getByRole("dialog");
    const proofs = within(dialog).getByLabelText(/Proof files/);
    const files = [1, 2, 3, 4].map((index) => new File(["x"], `proof-${index}.jpg`, { type: "image/jpeg" }));

    fireEvent.change(proofs, { target: { files } });

    expect(within(dialog).getByText("Attach at most 3 files.")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows the requester, the leave reason and the proof links in the review dialog", async () => {
    renderRequests({
      canReview: true,
      requests: [
        request({
          id: "review-target",
          employee_name: "Arnel Santiago",
          leave_reason: "sick",
          employee_request_attachments: [
            {
              id: "attachment-1",
              request_id: "review-target",
              original_name: "medical-certificate.pdf",
              file_kind: "file",
              file_size: 2048,
              signed_url: "https://signed/medical-certificate.pdf",
            },
          ],
        }),
      ],
    });

    const trigger = screen.getByRole("button", { name: "Open request actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.mouseUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Review request" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Arnel Santiago")).toBeInTheDocument();
    expect(within(dialog).getByText("Sick")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "medical-certificate.pdf" })).toHaveAttribute(
      "href",
      "https://signed/medical-certificate.pdf",
    );
  });

  it("searches the table by employee name", () => {
    renderRequests({ requests: [request({ employee_name: "Arnel Santiago" })] });
    const searchBox = screen.getByPlaceholderText("Search employee requests...");

    fireEvent.change(searchBox, { target: { value: "Arnel" } });
    expect(screen.getByText("Arnel Santiago")).toBeInTheDocument();

    fireEvent.change(searchBox, { target: { value: "Bea" } });
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("keeps the responsive table wrapper available on narrow layouts", () => {
    renderRequests();

    const table = screen.getByRole("table");
    expect(table.parentElement).toHaveClass("overflow-x-auto");
  });
});
