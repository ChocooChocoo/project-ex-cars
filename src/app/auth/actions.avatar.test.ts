import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

// Storage, type sniffing, the 2 MB cap and old-photo cleanup are Laravel's (PrivateFilesTest); these tests pin
// the action's quick checks, the request it sends and its error mapping.
const { apiWrite } = vi.hoisted(() => ({ apiWrite: vi.fn() }));
vi.mock("@/lib/api/revalidate", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/client", () => ({
  // Phase 4b: the actions call Laravel from the browser; delegate to the apiWrite mock so the request
  // assertions below stay as they were (trailing undefined arguments dropped).
  browserApi: (...args: unknown[]) => {
    while (args.length > 0 && args[args.length - 1] === undefined) args.pop();
    return Promise.resolve(apiWrite(...args)).then((result: { data?: unknown } | undefined) => result?.data);
  },
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
    apiWrite.mockResolvedValue({ status: 200, data: {}, setCookies: [] });
  });

  it("uploads the photo to Laravel as multipart", async () => {
    expect(await updateOwnAvatar(form(photo()))).toEqual({ success: true });
    const [method, path, body] = apiWrite.mock.calls[0];
    expect([method, path]).toEqual(["POST", "/api/v1/me/avatar"]);
    expect((body as FormData).get("avatar")).toBeInstanceOf(File);
  });

  it.each([
    [null, "Choose a photo to upload."],
    [photo("image/gif"), "Use a JPG, PNG or WebP photo."],
    [photo("image/png", 2 * 1024 * 1024 + 1), "The photo must be 2 MB or smaller."],
  ])("rejects %s before calling Laravel", async (file, error) => {
    expect(await updateOwnAvatar(form(file))).toEqual({ error });
    expect(apiWrite).not.toHaveBeenCalled();
  });

  it("maps a rejected upload to the existing message", async () => {
    apiWrite.mockRejectedValue(new ApiError(422, { code: "validation_error", message: "Only JPG" }));
    expect(await updateOwnAvatar(form(photo()))).toEqual({
      error: "The photo could not be uploaded. Please try again.",
    });
  });

  it("removes the photo", async () => {
    expect(await removeOwnAvatar()).toEqual({ success: true });
    expect(apiWrite).toHaveBeenCalledWith("DELETE", "/api/v1/me/avatar", undefined);
  });

  it("reports a signed-out session", async () => {
    apiWrite.mockRejectedValue(new ApiError(401, { code: "not_authenticated", message: "You must be signed in." }));
    expect(await removeOwnAvatar()).toEqual({ error: "Not authenticated" });
  });
});
