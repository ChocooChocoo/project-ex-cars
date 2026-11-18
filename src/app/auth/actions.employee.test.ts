import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiWrite, getSession } = vi.hoisted(() => ({ apiWrite: vi.fn(), getSession: vi.fn() }));

vi.mock("@/lib/api/revalidate", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/client", () => ({
  // Phase 4b: the actions call Laravel from the browser; delegate to the apiWrite mock so the request
  // assertions below stay as they were (trailing undefined arguments dropped).
  browserApi: (...args: unknown[]) => {
    while (args.length > 0 && args[args.length - 1] === undefined) args.pop();
    return Promise.resolve(apiWrite(...args)).then((result: { data?: unknown } | undefined) => result?.data);
  },
}));
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

  // Phase 4b: the role check is Laravel's (role:ceo,account_manager); its 403 becomes the same message.
  it("shows Laravel's refusal for a caller who is not the CEO or the Account Manager", async () => {
    apiWrite.mockRejectedValue(
      new ApiError(403, { code: "not_authorized", message: "You do not have permission for this action." }),
    );
    await expect(createEmployeeAccount(input)).resolves.toEqual({
      error: "You do not have permission for this action.",
    });
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
