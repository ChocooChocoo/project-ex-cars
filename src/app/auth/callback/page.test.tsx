import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CallbackPage from "./page";

const replace = vi.fn();
const original = window.location;

function open(search: string) {
  Object.defineProperty(window, "location", { configurable: true, value: { ...original, search, replace } });
  render(<CallbackPage />);
}

describe("auth callback (retired)", () => {
  afterEach(() => {
    replace.mockClear();
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("forwards a Laravel signed link to /auth/confirm", () => {
    open("?verify=%2Fapi%2Fv1%2Fauth%2Femail%2Fchange%2Fx");
    expect(replace).toHaveBeenCalledWith("/auth/confirm?verify=%2Fapi%2Fv1%2Fauth%2Femail%2Fchange%2Fx");
  });

  it("tells holders of an old Supabase link to sign in again", () => {
    open("?code=abc");
    expect(replace).toHaveBeenCalledWith("/auth/v1/login?error=link_expired");
  });
});
