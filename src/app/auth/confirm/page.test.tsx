import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

const { browserApi, setClientCookie } = vi.hoisted(() => ({ browserApi: vi.fn(), setClientCookie: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ browserApi }));
vi.mock("@/lib/cookie.client", () => ({ setClientCookie }));

import ConfirmPage from "./page";

const VERIFY =
  "/api/v1/auth/email/verify/9f1c2d3e-0000-4000-8000-000000000001/" +
  "a".repeat(40) +
  "?expires=1&signature=" +
  "b".repeat(64);
const CHANGE =
  "/api/v1/auth/email/change/9f1c2d3e-0000-4000-8000-000000000001?email=new%40x.co&expires=1&signature=" +
  "c".repeat(64);

const replace = vi.fn();
const original = window.location;

function open(query: Record<string, string>) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...original, search: `?${new URLSearchParams(query)}`, replace },
  });
  render(<ConfirmPage />);
}

describe("auth confirmation link (static page)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserApi.mockResolvedValue({ id: "u1", role: "customer" });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("calls Laravel's signed verification, sets the role hint and goes to the landing page", async () => {
    open({ verify: VERIFY });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/customer/showroom"));
    expect(browserApi).toHaveBeenCalledWith("GET", VERIFY);
    expect(setClientCookie).toHaveBeenCalledWith("gce-role", "customer", 7);
  });

  it("returns an email change to the same-site page in next, never off-site", async () => {
    open({ verify: CHANGE, next: "/customer/profile?notice=email_changed" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/customer/profile?notice=email_changed"));
    replace.mockClear();
    open({ verify: CHANGE, next: "//evil.example" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/customer/showroom"));
  });

  it.each([
    "/api/v1/me",
    "https://evil.example/api/v1/auth/email/verify/x/y?signature=1",
    "/api/v1/auth/email/verify/x/short?signature=1",
  ])("refuses %s without calling the API", async (verify) => {
    open({ verify });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/v1/login?error=confirmation_failed"));
    expect(browserApi).not.toHaveBeenCalled();
  });

  it("explains an expired link and a taken email", async () => {
    browserApi.mockRejectedValueOnce(new ApiError(403, { code: "not_authorized", message: "x" }));
    open({ verify: VERIFY });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/v1/login?error=confirmation_failed"));
    browserApi.mockRejectedValueOnce(new ApiError(409, { code: "conflict", message: "x" }));
    open({ verify: CHANGE });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/v1/login?error=email_taken"));
  });
});
