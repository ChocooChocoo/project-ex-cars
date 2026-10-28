import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  adminCreateUser,
  adminRpc,
  profileUpdate,
  profileEq,
  auditInsert,
  deleteUser,
  authorizeAction,
  revalidatePath,
} = vi.hoisted(() => ({
  adminCreateUser: vi.fn(),
  adminRpc: vi.fn(),
  profileUpdate: vi.fn(),
  profileEq: vi.fn(),
  auditInsert: vi.fn(),
  deleteUser: vi.fn(),
  authorizeAction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/action-guard", () => ({ authorizeAction }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: adminCreateUser, deleteUser } },
    rpc: adminRpc,
    from: vi.fn((table: string) =>
      table === "profiles" ? { update: profileUpdate, eq: profileEq } : { insert: auditInsert },
    ),
  }),
}));

import { createEmployeeAccount } from "./actions";

const actor = "11111111-1111-4111-8111-111111111111";
const createdUser = "22222222-2222-4222-8222-222222222222";

function params(role = "mechanic") {
  return { fullName: "Ramon Bautista", email: "ramon@gce.local", password: "Correct-horse-9", role };
}

describe("createEmployeeAccount (T04 E6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAction.mockResolvedValue({ ok: true, data: { userId: actor, role: "account_manager" } });
    adminCreateUser.mockResolvedValue({ data: { user: { id: createdUser } }, error: null });
    adminRpc.mockResolvedValue({ data: "ok", error: null });
    profileUpdate.mockReturnValue({ eq: profileEq });
    profileEq.mockResolvedValue({ error: null });
    auditInsert.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
  });

  it("creates a confirmed user and gives it the chosen role", async () => {
    await expect(createEmployeeAccount(params())).resolves.toEqual({ success: true });
    expect(authorizeAction).toHaveBeenCalledWith(["ceo", "account_manager"]);
    expect(adminCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ramon@gce.local", email_confirm: true }),
    );
    expect(adminRpc).toHaveBeenCalledWith("set_new_employee_role", {
      p_account_id: createdUser,
      p_role: "mechanic",
      p_assigned_by: actor,
    });
    expect(profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "Ramon Bautista", created_by: actor }),
    );
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ actor_id: actor, record_id: createdUser }));
    expect(revalidatePath).toHaveBeenCalledWith("/staff-records");
  });

  it("refuses a caller who is not the CEO or the Account Manager", async () => {
    authorizeAction.mockResolvedValue({ ok: false, code: "not_authorized", message: "Not authorized" });
    await expect(createEmployeeAccount(params())).resolves.toEqual({ error: "Not authorized" });
    expect(adminCreateUser).not.toHaveBeenCalled();
  });

  it.each(["ceo", "customer", "supplier"])("refuses the %s role before creating a user", async (role) => {
    const result = await createEmployeeAccount(params(role));
    expect(result).toHaveProperty("error");
    expect(adminCreateUser).not.toHaveBeenCalled();
  });

  it("removes the new user when the role cannot be set", async () => {
    adminRpc.mockResolvedValue({ data: null, error: { message: "Permission denied" } });
    await expect(createEmployeeAccount(params())).resolves.toEqual({ error: "Permission denied" });
    expect(deleteUser).toHaveBeenCalledWith(createdUser);
    expect(auditInsert).not.toHaveBeenCalled();
  });
});
