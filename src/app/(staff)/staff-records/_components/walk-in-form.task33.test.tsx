import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWalkInAccount } from "@/app/auth/actions";

import { WalkInForm } from "./walk-in-form";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/app/auth/actions", () => ({ createWalkInAccount: vi.fn() }));

const createWalkInAccountMock = vi.mocked(createWalkInAccount);

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
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Walk-in Customer" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "walkin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() =>
      expect(createWalkInAccountMock).toHaveBeenCalledWith({
        fullName: "Walk-in Customer",
        email: "walkin@example.com",
        password: "correct-horse",
      }),
    );
  });
});
