import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminCreateUser, profileUpdate, profileEq, auditInsert, deleteUser, authorizeAction, revalidatePath, rpc } =
  vi.hoisted(() => ({
    adminCreateUser: vi.fn(),
    profileUpdate: vi.fn(),
    profileEq: vi.fn(),
    auditInsert: vi.fn(),
    deleteUser: vi.fn(),
    authorizeAction: vi.fn(),
    revalidatePath: vi.fn(),
    rpc: vi.fn(),
  }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/action-guard", () => ({ authorizeAction }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: actor } } })) },
    rpc,
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: adminCreateUser, deleteUser } },
    from: vi.fn((table: string) =>
      table === "profiles" ? { update: profileUpdate, eq: profileEq } : { insert: auditInsert },
    ),
  }),
}));

import { createWalkInAccount } from "./actions";

const actor = "11111111-1111-4111-8111-111111111111";
const createdUser = "22222222-2222-4222-8222-222222222222";

function validParams() {
  return { fullName: "Walk-in Customer", email: "walkin@example.com", password: "correct-horse" };
}

describe("createWalkInAccount Task 33", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAction.mockResolvedValue({ ok: true, data: { userId: actor, role: "account_manager" } });
    adminCreateUser.mockResolvedValue({ data: { user: { id: createdUser } }, error: null });
    profileUpdate.mockReturnValue({ eq: profileEq });
    profileEq.mockResolvedValue({ error: null });
    auditInsert.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: [{ account_id: actor, role: "account_manager" }], error: null });
  });

  it("uses the authorized Account Manager actor and reports success only after all writes", async () => {
    await expect(createWalkInAccount(validParams())).resolves.toEqual({ success: true });
    expect(authorizeAction).toHaveBeenCalledWith(["account_manager"]);
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({ created_by: actor }));
    expect(profileEq).toHaveBeenCalledWith("id", createdUser);
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ actor_id: actor, record_id: createdUser }));
    expect(revalidatePath).toHaveBeenCalledWith("/staff-records");
  });

  it("rejects malformed input before creating an auth user", async () => {
    await expect(createWalkInAccount({ ...validParams(), email: "not-an-email" })).resolves.toEqual({
      error: expect.stringMatching(/email/i),
    });
    expect(adminCreateUser).not.toHaveBeenCalled();
  });

  it("rejects a CEO authorization result before creating an auth user", async () => {
    authorizeAction.mockResolvedValue({
      ok: false,
      code: "not_authorized",
      message: "You do not have permission for this action.",
    });

    await expect(createWalkInAccount(validParams())).resolves.toEqual({
      error: "You do not have permission for this action.",
    });
    expect(adminCreateUser).not.toHaveBeenCalled();
  });

  it("returns auth creation errors without attempting downstream writes", async () => {
    adminCreateUser.mockResolvedValue({ data: { user: null }, error: { message: "auth failed" } });

    await expect(createWalkInAccount(validParams())).resolves.toEqual({ error: "auth failed" });
    expect(profileUpdate).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("rolls back the auth user when profile persistence fails", async () => {
    profileEq.mockResolvedValue({ error: { message: "profile failed" } });
    await expect(createWalkInAccount(validParams())).resolves.toEqual({ error: "profile failed" });
    expect(deleteUser).toHaveBeenCalledWith(createdUser);
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("rolls back the auth user when audit persistence fails", async () => {
    auditInsert.mockResolvedValue({ error: { message: "audit failed" } });
    await expect(createWalkInAccount(validParams())).resolves.toEqual({ error: "audit failed" });
    expect(deleteUser).toHaveBeenCalledWith(createdUser);
  });
});
