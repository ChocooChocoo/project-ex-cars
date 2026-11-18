import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiWrite, relaySetCookies } = vi.hoisted(() => ({ apiWrite: vi.fn(), relaySetCookies: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/server", () => ({ apiWrite, relaySetCookies }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

import { ApiError } from "@/lib/api/errors";

import { changeOwnPassword, updateOwnProfile } from "./actions";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiWrite.mockResolvedValue({ status: 200, data: {}, setCookies: ["gce_session=new; path=/"] });
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

const sentProfile = () => apiWrite.mock.calls[0][2];

describe("updateOwnProfile", () => {
  it("sends the address parts and the composed address; no account id or extra field leaves Next.js", async () => {
    const result = await updateOwnProfile(
      form({ full_name: " Juan Dela Cruz ", phone: "09171234567", ...address, account_state: "x" }),
    );

    expect(result).toEqual({ success: true });
    expect(apiWrite).toHaveBeenCalledWith("PATCH", "/api/v1/me/profile", {
      full_name: "Juan Dela Cruz",
      phone: "09171234567",
      address: "Block 4 Lot 5, Bagong Kalsada, City of Calamba, Laguna, CALABARZON",
      address_line: "Block 4 Lot 5",
      region_code: "040000000",
      province_code: "043400000",
      city_code: "043405000",
      barangay_code: "043405001",
    });
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
    expect(sentProfile()).toEqual(
      expect.objectContaining({ address: "Block 4 Lot 5, Barangay 1, City of Manila, NCR", province_code: null }),
    );
  });

  it("sends an empty phone and block/lot as null", async () => {
    await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "", address_line: "" }));
    expect(sentProfile()).toEqual(
      expect.objectContaining({
        phone: null,
        address_line: null,
        address: "Bagong Kalsada, City of Calamba, Laguna, CALABARZON",
      }),
    );
  });

  it("refuses bad input without calling Laravel", async () => {
    expect(await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "", barangay_code: "" }))).toEqual({
      error: "Choose your barangay.",
    });
    expect(await updateOwnProfile(form({ ...address, full_name: "  " }))).toEqual({ error: "Name is required." });
    expect(await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "12345" }))).toHaveProperty("error");
    expect(apiWrite).not.toHaveBeenCalled();
  });

  it("returns Laravel's validation message, and 'Not authenticated' for a dead session", async () => {
    apiWrite.mockRejectedValueOnce(new ApiError(422, { code: "validation_error", message: "Choose your region." }));
    expect(await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "" }))).toEqual({
      error: "Choose your region.",
    });
    apiWrite.mockRejectedValueOnce(new ApiError(401, { code: "not_authenticated" }));
    expect(await updateOwnProfile(form({ ...address, full_name: "Juan", phone: "" }))).toEqual({
      error: "Not authenticated",
    });
  });
});

describe("changeOwnPassword", () => {
  const valid = {
    current_password: "old-password",
    new_password: "New-password-1",
    confirm_password: "New-password-1",
  };

  it("sends current and new password, then relays the rotated session cookie", async () => {
    expect(await changeOwnPassword(form(valid))).toEqual({ success: true });
    expect(apiWrite).toHaveBeenCalledWith("PUT", "/api/v1/me/password", {
      current_password: "old-password",
      new_password: "New-password-1",
    });
    expect(relaySetCookies).toHaveBeenCalledWith(["gce_session=new; path=/"]);
  });

  it("refuses a wrong current password with Laravel's message", async () => {
    apiWrite.mockRejectedValue(
      new ApiError(422, { code: "validation_error", message: "Your current password is not correct." }),
    );
    expect(await changeOwnPassword(form(valid))).toEqual({ error: "Your current password is not correct." });
  });

  it("refuses mismatched, short or weak new passwords before any request", async () => {
    expect(await changeOwnPassword(form({ ...valid, confirm_password: "different-1" }))).toEqual({
      error: "The new passwords do not match.",
    });
    expect(
      await changeOwnPassword(form({ ...valid, new_password: "short", confirm_password: "short" })),
    ).toHaveProperty("error");
    expect(await changeOwnPassword(form({ ...valid, new_password: "abcdefgh", confirm_password: "abcdefgh" }))).toEqual(
      {
        error: "Add an uppercase letter.",
      },
    );
    expect(apiWrite).not.toHaveBeenCalled();
  });
});
