import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { markNotificationRead, markAllNotificationsRead } = vi.hoisted(() => ({
  markNotificationRead: vi.fn(async () => ({})),
  markAllNotificationsRead: vi.fn(async () => ({})),
}));

vi.mock("@/lib/notifications/actions", () => ({ markNotificationRead, markAllNotificationsRead }));
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...rest }: React.ComponentProps<"a">) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

import type { NotificationRow } from "@/lib/notifications/actions";

import { NotificationPopover } from "./notification-popover";

const row = (over: Partial<NotificationRow>): NotificationRow => ({
  id: "n-1",
  recipient_role: "sales_manager",
  recipient_id: null,
  kind: "x",
  title: "Buyer uploaded an ID",
  body: null,
  is_read: false,
  reference_table: "transactions",
  reference_id: "tx-1",
  created_at: new Date().toISOString(),
  href: "/sales_manager/transactions/tx-1",
  ...over,
});

describe("NotificationPopover (T03 G1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("links a notification to its record, marks it read and closes on click", async () => {
    render(<NotificationPopover notifications={[row({})]} />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));

    const link = await screen.findByRole("link", { name: "Buyer uploaded an ID" });
    expect(link).toHaveAttribute("href", "/sales_manager/transactions/tx-1");

    fireEvent.click(link);

    expect(markNotificationRead).toHaveBeenCalledWith("n-1");
    await waitFor(() => expect(screen.queryByRole("link", { name: "Buyer uploaded an ID" })).not.toBeInTheDocument());
  });

  it("shows a notification without a page as plain text", async () => {
    render(<NotificationPopover notifications={[row({ id: "n-2", title: "Payroll ready", href: null })]} />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(await screen.findByText("Payroll ready")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
