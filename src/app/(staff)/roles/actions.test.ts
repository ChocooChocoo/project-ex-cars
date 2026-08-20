import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, from, rpc, authorizeAction } = vi.hoisted(() => {
  const insert = vi.fn();
  return {
    insert,
    from: vi.fn(() => ({ insert })),
    rpc: vi.fn(),
    authorizeAction: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/action-guard", () => ({ authorizeAction }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ from, rpc })),
}));

import { createRbacPermission, createRbacRole, updateRbacRole } from "./actions";

const manager = { ok: true, data: { userId: "11111111-1111-4111-8111-111111111111", role: "account_manager" } };
const roleKey = "account_manager";

function form(values: Record<string, string>, permissionIds: string[] = []) {
  const value = new FormData();
  for (const [key, entry] of Object.entries(values)) value.set(key, entry);
  for (const permissionId of permissionIds) value.append("permissionIds", permissionId);
  return value;
}

describe("RBAC server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeAction.mockResolvedValue(manager);
    insert.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("rejects a role outside the managed role list before writing", async () => {
    const result = await createRbacRole(
      form({ roleKey: "ceo", description: "Executive", status: "active", isProtected: "true" }),
    );

    expect(result).toEqual({ error: expect.stringMatching(/invalid|role/i) });
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates a permission from catalog keys without accepting generated fields", async () => {
    const result = await createRbacPermission(
      form({
        accessAreaKey: "vehicles",
        actionKey: "read",
        accessLabel: "Forged label",
        permissionKey: "forged.key",
        description: "Read vehicle records.",
        status: "active",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith({
      access_area_key: "vehicles",
      action_key: "read",
      description: "Read vehicle records.",
      status: "active",
    });
  });

  it("rejects permission keys outside the seeded catalogs", async () => {
    const result = await createRbacPermission(
      form({ accessAreaKey: "not_a_catalog_area", actionKey: "read", description: "", status: "active" }),
    );

    expect(result).toEqual({ error: expect.stringMatching(/invalid|expected/i) });
    expect(insert).not.toHaveBeenCalled();
  });

  it("deduplicates permission ids before atomically updating a role", async () => {
    const firstPermission = "22222222-2222-4222-8222-222222222222";
    const secondPermission = "33333333-3333-4333-8333-333333333333";

    const result = await updateRbacRole(
      form({ roleKey, description: "Operations", status: "active", isProtected: "false" }, [
        firstPermission,
        firstPermission,
        secondPermission,
      ]),
    );

    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("update_rbac_role", {
      p_role_key: roleKey,
      p_description: "Operations",
      p_status: "active",
      p_is_protected: false,
      p_permission_ids: [firstPermission, secondPermission],
    });
  });

  it("returns an authorization error without touching the database", async () => {
    authorizeAction.mockResolvedValue({ ok: false, code: "not_authorized", message: "Not authorized" });

    const result = await createRbacPermission(
      form({ accessAreaKey: "vehicles", actionKey: "read", description: "", status: "active" }),
    );

    expect(result).toEqual({ error: "Not authorized" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("maps duplicate database errors to a useful message", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });

    const result = await createRbacPermission(
      form({ accessAreaKey: "vehicles", actionKey: "read", description: "", status: "active" }),
    );

    expect(result).toEqual({ error: "That permission already exists." });
  });
});
