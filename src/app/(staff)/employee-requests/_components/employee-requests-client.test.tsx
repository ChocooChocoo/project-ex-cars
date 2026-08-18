import type { ComponentProps } from "react";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type EmployeeRequestRow, EmployeeRequestsClient } from "./employee-requests-client";

const mocks = vi.hoisted(() => ({
  cancelEmployeeRequest: vi.fn(),
  refresh: vi.fn(),
  reviewEmployeeRequest: vi.fn(),
  submitEmployeeRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/(staff)/employee-requests/actions", () => ({
  cancelEmployeeRequest: mocks.cancelEmployeeRequest,
  reviewEmployeeRequest: mocks.reviewEmployeeRequest,
  submitEmployeeRequest: mocks.submitEmployeeRequest,
}));

function request(overrides: Partial<EmployeeRequestRow> = {}): EmployeeRequestRow {
  return {
    id: "request-1",
    employee_id: "employee-1",
    request_kind: "leave",
    status: "pending",
    start_date: "2026-08-10",
    end_date: "2026-08-11",
    reason: "Family event",
    review_notes: null,
    reviewed_at: null,
    ...overrides,
  };
}

function renderRequests(options: Partial<ComponentProps<typeof EmployeeRequestsClient>> = {}) {
  return render(<EmployeeRequestsClient requests={[request()]} canReview={false} canSubmit {...options} />);
}

describe("EmployeeRequestsClient", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
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

  it("keeps the responsive table wrapper available on narrow layouts", () => {
    renderRequests();

    const table = screen.getByRole("table");
    expect(table.parentElement).toHaveClass("overflow-x-auto");
  });
});
