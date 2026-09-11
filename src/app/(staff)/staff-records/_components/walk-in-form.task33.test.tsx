import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWalkInAccount } from "@/app/auth/actions";

import { WalkInForm } from "./walk-in-form";

const STAFF_RECORDS_PATH = "/account_manager/staff-records";

const { replaceMock, toastMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/account_manager/staff-records",
  useRouter: () => ({ replace: replaceMock }),
}));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/app/auth/actions", () => ({ createWalkInAccount: vi.fn() }));

const createWalkInAccountMock = vi.mocked(createWalkInAccount);

function fillValidAccount() {
  fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Walk-in Customer" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "walkin@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse" } });
}

describe("WalkInForm Task 33", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createWalkInAccountMock.mockResolvedValue({ success: true });
  });

  it("opens the reused dialog when the deep-link requests createWalkIn", () => {
    render(<WalkInForm initialOpen />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create Walk-in Account" })).toBeInTheDocument();
  });

  it("opens the dialog when the deep link arrives on an already-mounted page", () => {
    const { rerender } = render(<WalkInForm initialOpen={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<WalkInForm initialOpen />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create Walk-in Account" })).toBeInTheDocument();
  });

  it("submits only the supported account fields", async () => {
    render(<WalkInForm />);
    fireEvent.click(screen.getByRole("button", { name: "Create Walk-in Account" }));
    fillValidAccount();
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() =>
      expect(createWalkInAccountMock).toHaveBeenCalledWith({
        fullName: "Walk-in Customer",
        email: "walkin@example.com",
        password: "correct-horse",
      }),
    );
  });

  it("consumes the deep link once after a successful creation", async () => {
    render(<WalkInForm initialOpen />);
    fillValidAccount();

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith(STAFF_RECORDS_PATH);
    expect(toastMock.success).toHaveBeenCalledWith("Walk-in account created.");
  });

  it("consumes the deep link once when the dialog is cancelled", () => {
    render(<WalkInForm initialOpen />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(STAFF_RECORDS_PATH);
  });

  it("leaves the URL untouched when the dialog is opened without the deep link", () => {
    render(<WalkInForm />);
    fireEvent.click(screen.getByRole("button", { name: "Create Walk-in Account" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
