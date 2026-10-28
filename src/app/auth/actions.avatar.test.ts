import { beforeEach, describe, expect, it, vi } from "vitest";

const { upload, remove, update, updateEq, maybeSingle, updateUser, getUser } = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  maybeSingle: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
}));

const userId = "11111111-1111-4111-8111-111111111111";
const base = "https://x.supabase.co/storage/v1/object/public/avatars/";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser, updateUser },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      update,
    })),
    storage: {
      from: vi.fn(() => ({
        upload,
        remove,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `${base}${path}` } }),
      })),
    },
  })),
}));

import { removeOwnAvatar, updateOwnAvatar } from "./actions";

function form(file: File | null) {
  const data = new FormData();
  if (file) data.set("avatar", file);
  return data;
}

function photo(type = "image/png", bytes = 1024) {
  return new File([new Uint8Array(bytes)], "me.png", { type });
}

describe("profile photo actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: userId } } });
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq: updateEq });
    updateEq.mockResolvedValue({ error: null });
    maybeSingle.mockResolvedValue({ data: { avatar_url: `${base}${userId}/avatar-1.png` } });
    updateUser.mockResolvedValue({ error: null });
  });

  it("uploads into the user's folder, saves the URL and deletes the old file", async () => {
    expect(await updateOwnAvatar(form(photo()))).toEqual({ success: true });

    const path = upload.mock.calls[0]?.[0] as string;
    expect(path).toMatch(new RegExp(`^${userId}/avatar-\\d+\\.png$`));
    expect(update).toHaveBeenCalledWith({ avatar_url: `${base}${path}` });
    expect(updateUser).toHaveBeenCalledWith({ data: { avatar_url: `${base}${path}` } });
    expect(remove).toHaveBeenCalledWith([`${userId}/avatar-1.png`]);
  });

  it.each([
    ["no file", null, "Choose a photo to upload."],
    ["a PDF", photo("application/pdf"), "Use a JPG, PNG or WebP photo."],
    ["a 3 MB photo", photo("image/jpeg", 3 * 1024 * 1024), "The photo must be 2 MB or smaller."],
  ])("refuses %s before uploading", async (_name, file, error) => {
    expect(await updateOwnAvatar(form(file))).toEqual({ error });
    expect(upload).not.toHaveBeenCalled();
  });

  it("removes the new file when the profile cannot be saved", async () => {
    updateEq.mockResolvedValue({ error: { message: "denied" } });

    expect(await updateOwnAvatar(form(photo()))).toEqual({ error: "denied" });
    const path = upload.mock.calls[0]?.[0];
    expect(remove).toHaveBeenCalledWith([path]);
  });

  it("reports a failed upload without touching the profile", async () => {
    upload.mockResolvedValue({ error: { message: "too big" } });

    expect(await updateOwnAvatar(form(photo()))).toEqual({
      error: "The photo could not be uploaded. Please try again.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("clears the photo and deletes the file on remove", async () => {
    expect(await removeOwnAvatar()).toEqual({ success: true });
    expect(update).toHaveBeenCalledWith({ avatar_url: null });
    expect(updateUser).toHaveBeenCalledWith({ data: { avatar_url: null } });
    expect(remove).toHaveBeenCalledWith([`${userId}/avatar-1.png`]);
  });

  it("refuses signed-out callers", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await removeOwnAvatar()).toEqual({ error: "Not authenticated" });
    expect(update).not.toHaveBeenCalled();
  });
});
