import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, eq, updateUser, signInWithPassword, signOut } = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  updateUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

const userId = "11111111-1111-4111-8111-111111111111";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: userId, email: "buyer@example.com" } } })),
      updateUser,
    },
    from: vi.fn(() => ({ update })),
  })),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithPassword, signOut } })),
}));

import { changeOwnPassword, updateOwnProfile } from "./actions";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockReturnValue({ eq });
  eq.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
});

const address = {
  address_line: "Block 4 Lot 5",
  region_code: "040000000",
  region_name: "CALABARZON",
  province_code: "043400000",
  province_name: "Laguna",
  city_code: "043405000",
  city_name: "City of Calamba",
  barangay_code: "043405001",
  barangay_name: "Bagong Kalsada",
};

describe("updateOwnProfile", () => {
  it("writes the address parts and the composed address on the caller's own row", async () => {
    const result = await updateOwnProfile(
      form({
        full_name: " Juan Dela Cruz ",
        phone: "09171234567",
        ...address,
        account_state: "x",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(update).toHaveBeenCalledWith({
      full_name: "Juan Dela Cruz",
      phone: "09171234567",
      address: "Block 4 Lot 5, Bagong Kalsada, City of Calamba, Laguna, CALABARZON",
      address_line: "Block 4 Lot 5",
      region_code: "040000000",
      province_code: "043400000",
      city_code: "043405000",
      barangay_code: "043405001",
    });
    expect(eq).toHaveBeenCalledWith("id", userId);
    expect(updateUser).toHaveBeenCalledWith({ data: { full_name: "Juan Dela Cruz" } });
  });

  it("saves an NCR address without a province", async () => {
    await updateOwnProfile(
      form({
        ...address,
        full_name: "Juan",
        phone: "",
        region_code: "130000000",
        region_name: "NCR",
        province_code: "",
        province_name: "",
        city_code: "133900000",
        city_name: "City of Manila",
        barangay_code: "133901001",
        barangay_name: "Barangay 1",
      }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "Block 4 Lot 5, Barangay 1, City of Manila, NCR",
        province_code: null,
      }),
    );
  });

  it("stores an empty phone and block/lot as null", async () => {
    await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "", address_line: "" }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "Juan", phone: null, address_line: null }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ address: "Bagong Kalsada, City of Calamba, Laguna, CALABARZON" }),
    );
  });

  it("refuses an address with no barangay without writing", async () => {
    expect(await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "", barangay_code: "" }))).toEqual({
      error: "Choose your barangay.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a blank name and a bad phone without writing", async () => {
    expect(await updateOwnProfile(form({ ...address, full_name: "  " }))).toEqual({
      error: "Name is required.",
    });
    expect(await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "12345" }))).toHaveProperty("error");
    expect(update).not.toHaveBeenCalled();
  });

  it("returns the database error", async () => {
    eq.mockResolvedValue({ error: { message: "permission denied" } });
    expect(await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "" }))).toEqual({
      error: "permission denied",
    });
  });
});

describe("changeOwnPassword", () => {
  const valid = {
    current_password: "old-password",
    new_password: "New-password-1",
    confirm_password: "New-password-1",
  };

  it("checks the current password, then sets the new one", async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    expect(await changeOwnPassword(form(valid))).toEqual({ success: true });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "buyer@example.com", password: "old-password" });
    expect(updateUser).toHaveBeenCalledWith({ password: "New-password-1" });
  });

  it("refuses a wrong current password", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    expect(await changeOwnPassword(form(valid))).toEqual({ error: "Your current password is not correct." });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses mismatched or too short new passwords", async () => {
    expect(await changeOwnPassword(form({ ...valid, confirm_password: "different-1" }))).toEqual({
      error: "The new passwords do not match.",
    });
    expect(
      await changeOwnPassword(form({ ...valid, new_password: "short", confirm_password: "short" })),
    ).toHaveProperty("error");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("refuses a weak new password", async () => {
    expect(await changeOwnPassword(form({ ...valid, new_password: "abcdefgh", confirm_password: "abcdefgh" }))).toEqual(
      {
        error: "Add an uppercase letter.",
      },
    );
    expect(updateUser).not.toHaveBeenCalled();
  });
});
