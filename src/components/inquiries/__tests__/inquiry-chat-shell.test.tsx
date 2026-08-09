import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { failure, success } from "@/lib/auth/action-result";

import { InquiryChatShell } from "../inquiry-chat-shell";
import type { InquiryRecord, InquiryThreadData, InquiryThreadLoader } from "../types";

function makeInquiry(id: string, state: string): InquiryRecord {
  return {
    id,
    state,
    intention_kind: "inquiry",
    updated_at: "2026-08-09T00:00:00.000Z",
    vehicles: { make: "Toyota", model: id, year: 2020 },
  };
}

function makeThread(id: string): InquiryThreadData {
  return {
    inquiry: makeInquiry(id, "open"),
    messages: [],
    arrangement: null,
  };
}

function renderShell(inquiries: InquiryRecord[], loadThread: InquiryThreadLoader) {
  return render(
    <InquiryChatShell
      title="Inquiries"
      inquiries={inquiries}
      emptyMessage="No conversations yet."
      loadThread={loadThread}
      renderThread={(thread) => <div data-testid="thread">{thread.inquiry.id as string}</div>}
    />,
  );
}

describe("InquiryChatShell", () => {
  it("loads the first inquiry automatically", async () => {
    const loadThread = vi.fn(async (id: string) => success(makeThread(id)));

    renderShell([makeInquiry("a", "open")], loadThread);

    await waitFor(() => expect(loadThread).toHaveBeenCalledWith("a"));
    expect(await screen.findByTestId("thread")).toHaveTextContent("a");
    expect(screen.queryByText("Select a conversation to view messages.")).not.toBeInTheDocument();
  });

  it("loads the selected inquiry and reconciles selection when the filter changes", async () => {
    const loadThread = vi.fn(async (id: string) => success(makeThread(id)));

    renderShell([makeInquiry("open-one", "open"), makeInquiry("closed-one", "closed")], loadThread);
    await screen.findByRole("button", { name: /open-one/ });

    const closedTab = screen.getByRole("tab", { name: /Closed/ });
    fireEvent.pointerDown(closedTab);
    fireEvent.mouseDown(closedTab, { button: 0 });
    fireEvent.mouseUp(closedTab, { button: 0 });
    fireEvent.click(closedTab);

    await waitFor(() => expect(screen.getByRole("tab", { name: /Closed/ })).toHaveAttribute("aria-selected", "true"));
    await waitFor(() => expect(loadThread).toHaveBeenCalledWith("closed-one"));
    expect(await screen.findByTestId("thread")).toHaveTextContent("closed-one");
  });

  it("keeps the newest selection when an older request resolves later", async () => {
    let resolveFirst: ((result: ReturnType<typeof success<InquiryThreadData>>) => void) | undefined;
    let resolveSecond: ((result: ReturnType<typeof success<InquiryThreadData>>) => void) | undefined;
    const loadThread = vi.fn((id: string) => {
      if (id === "first") {
        return new Promise<ReturnType<typeof success<InquiryThreadData>>>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return new Promise<ReturnType<typeof success<InquiryThreadData>>>((resolve) => {
        resolveSecond = resolve;
      });
    });

    renderShell([makeInquiry("first", "open"), makeInquiry("second", "open")], loadThread);
    await screen.findByRole("button", { name: /first/ });
    fireEvent.click(screen.getByRole("button", { name: /second/ }));

    resolveSecond?.(success(makeThread("second")));
    expect(await screen.findByTestId("thread")).toHaveTextContent("second");

    resolveFirst?.(success(makeThread("first")));
    await waitFor(() => expect(screen.getByTestId("thread")).toHaveTextContent("second"));
  });

  it("shows a retryable load error instead of the selection placeholder", async () => {
    const loadThread = vi
      .fn()
      .mockResolvedValueOnce(failure("load_failed", "Could not load this conversation."))
      .mockResolvedValueOnce(success(makeThread("retry")));

    renderShell([makeInquiry("retry", "open")], loadThread);

    expect(await screen.findByText("Could not load this conversation.")).toBeInTheDocument();
    expect(screen.queryByText("Select a conversation to view messages.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("thread")).toHaveTextContent("retry");
  });

  it("shows the legitimate empty state without loading a thread", () => {
    const loadThread = vi.fn(async (id: string) => success(makeThread(id)));

    renderShell([], loadThread);

    expect(screen.getByText("No conversations yet.")).toBeInTheDocument();
    expect(loadThread).not.toHaveBeenCalled();
  });
});
