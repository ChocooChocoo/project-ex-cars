import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiWrite, getSession } = vi.hoisted(() => ({ apiWrite: vi.fn(), getSession: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/server", () => ({ apiWrite, relaySetCookies: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession }));

import { ApiError } from "@/lib/api/errors";

import { createEmployeeAccount } from "./actions";

const input = { fullName: "New Hire", email: "hire@gce.test", password: "Secret#123", role: "mechanic" };

// T04 E6. Role, profile, schedule and audit are one Laravel transaction (backend AuthorizationMatrixTest);
// this side owns the early role check, input validation and the request it sends.
describe("createEmployeeAccount (T04 E6)", () => {
  beforeEach(() => {
    apiWrite.mockReset().mockResolvedValue({ status: 201, data: { id: "u1" }, setCookies: [] });
    getSession.mockReset().mockResolvedValue({ id: "am-1", role: "account_manager" });
  });

  it("asks Laravel to create the account with the chosen role and no actor field", async () => {
    await expect(createEmployeeAccount(input)).resolves.toEqual({ success: true });
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/admin/accounts/employee", {
      full_name: "New Hire",
      email: "hire@gce.test",
      password: "Secret#123",
      role: "mechanic",
    });
  });

  it("refuses a caller who is not the CEO or the Account Manager without calling the API", async () => {
    getSession.mockResolvedValue({ id: "sm-1", role: "sales_manager" });
    await expect(createEmployeeAccount(input)).resolves.toEqual({
      error: "You do not have permission for this action.",
    });
    expect(apiWrite).not.toHaveBeenCalled();
  });

  it("refuses the CEO role and a weak password before any request", async () => {
    expect(await createEmployeeAccount({ ...input, role: "ceo" })).toEqual({ error: "Choose a staff role." });
    expect(await createEmployeeAccount({ ...input, password: "weakpassword" })).toHaveProperty("error");
    expect(apiWrite).not.toHaveBeenCalled();
  });

  it("passes Laravel's validation message through", async () => {
    apiWrite.mockRejectedValue(
      new ApiError(422, {
        code: "validation_error",
        message: "A user with this email address has already been registered",
      }),
    );
    await expect(createEmployeeAccount(input)).resolves.toEqual({
      error: "A user with this email address has already been registered",
    });
  });

  it("reports an outage, not a permission error, when Laravel is unreachable", async () => {
    apiWrite.mockRejectedValue(new ApiError(0, {}));
    const result = (await createEmployeeAccount(input)) as { error: string };
    expect(result.error).toMatch(/not reachable/);
  });
});
