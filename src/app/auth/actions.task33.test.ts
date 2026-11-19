import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiWrite, revalidatePath } = vi.hoisted(() => ({
  apiWrite: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/api/revalidate", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({
  // Phase 4b: the actions call Laravel from the browser; delegate to the apiWrite mock so the request
  // assertions below stay as they were (trailing undefined arguments dropped).
  browserApi: (...args: unknown[]) => {
    while (args.length > 0 && args[args.length - 1] === undefined) args.pop();
    return Promise.resolve(apiWrite(...args)).then((result: { data?: unknown } | undefined) => result?.data);
  },
}));

import { ApiError } from "@/lib/api/errors";

import { assignRole, createWalkInAccount } from "./actions";

const input = { fullName: "Walk In", email: "walkin@gce.test", password: "Secret#123" };

describe("createWalkInAccount Task 33", () => {
  beforeEach(() => {
    apiWrite.mockReset().mockResolvedValue({ status: 201, data: { id: "c1" }, setCookies: [] });
    revalidatePath.mockReset();
  });

  it("creates the account through Laravel and refreshes staff records only on success", async () => {
    await expect(createWalkInAccount(input)).resolves.toEqual({ success: true });
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/admin/accounts/walk-in", {
      full_name: "Walk In",
      email: "walkin@gce.test",
      password: "Secret#123",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/staff-records");
  });

  it("rejects malformed input and a weak password before any request", async () => {
    expect(await createWalkInAccount({ ...input, email: "nope" })).toHaveProperty("error");
    expect(await createWalkInAccount({ ...input, password: "alllowercase1!" })).toHaveProperty("error");
    expect(apiWrite).not.toHaveBeenCalled();
  });

  // Phase 4b: the role check is Laravel's (role:account_manager,ceo); its 403 becomes the same message.
  it("shows Laravel's refusal for a staff role outside AM/CEO", async () => {
    apiWrite.mockRejectedValue(
      new ApiError(403, { code: "not_authorized", message: "You do not have permission for this action." }),
    );
    expect(await createWalkInAccount(input)).toEqual({ error: "You do not have permission for this action." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns Laravel's error and does not refresh on failure", async () => {
    apiWrite.mockRejectedValue(new ApiError(422, { code: "validation_error", message: "Email taken" }));
    expect(await createWalkInAccount(input)).toEqual({ error: "Email taken" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("assignRole", () => {
  beforeEach(() => apiWrite.mockReset().mockResolvedValue({ status: 200, data: { ok: true }, setCookies: [] }));

  it("never forwards a caller-supplied assignedBy; Laravel records the session user", async () => {
    await expect(assignRole({ accountId: "a1", role: "mechanic", assignedBy: "forged" })).resolves.toEqual({
      success: true,
    });
    expect(apiWrite).toHaveBeenCalledWith("POST", "/api/v1/admin/roles", { account_id: "a1", role: "mechanic" });
  });

  it("maps 401 and 403 to the existing messages", async () => {
    apiWrite.mockRejectedValueOnce(new ApiError(401, { code: "not_authenticated" }));
    expect(await assignRole({ accountId: "a1", role: "mechanic" })).toEqual({ error: "Not authenticated" });
    apiWrite.mockRejectedValueOnce(new ApiError(403, { code: "not_authorized" }));
    expect(await assignRole({ accountId: "a1", role: "mechanic" })).toEqual({ error: "Not authorized" });
  });
});
