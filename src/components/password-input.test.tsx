import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("flips the input type and the button label on every click", () => {
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Show password" }));
      expect(input).toHaveAttribute("type", "text");
      fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
      expect(input).toHaveAttribute("type", "password");
    }
  });

  it("does not submit the surrounding form", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Password" />
      </form>,
    );
    const button = screen.getByRole("button", { name: "Show password" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
