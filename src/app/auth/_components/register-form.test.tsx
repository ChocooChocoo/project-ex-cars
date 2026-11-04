import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegisterForm } from "./register-form";

vi.mock("@/app/auth/actions", () => ({ signUp: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// The checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {
    return;
  }
  unobserve() {
    return;
  }
  disconnect() {
    return;
  }
};

describe("RegisterForm agreements (T06)", () => {
  it("unlocks each checkbox only after its document is read", () => {
    render(<RegisterForm />);
    const terms = screen.getByRole("checkbox", { name: /Terms and Conditions/ });
    const policy = screen.getByRole("checkbox", { name: /Company Policy/ });
    expect(terms).toBeDisabled();
    expect(policy).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Read the Terms and Conditions" }));
    fireEvent.click(screen.getByRole("button", { name: "I have read this" }));

    expect(terms).toBeEnabled();
    expect(policy).toBeDisabled();
  });
});
