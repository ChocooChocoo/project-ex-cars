import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

// Storage, type sniffing, the size cap and the server-picked path are Laravel's (InquiryTest, PrivateFilesTest).
// These tests pin the action's quick checks and the one multipart request it sends.
const { apiWrite } = vi.hoisted(() => ({ apiWrite: vi.fn() }));
vi.mock("@/lib/api/revalidate", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/client", () => ({
  // Phase 4b: browser calls; delegate to the apiWrite mock so the request assertions stay as they were.
  browserApi: (...args: unknown[]) =>
    Promise.resolve(apiWrite(...args)).then((r: { data?: unknown } | undefined) => r?.data),
}));

import { sendMessageWithAttachment } from "./actions";

const inquiryId = "22222222-2222-4222-8222-222222222222";

function messageForm(text: string, file?: File) {
  const data = new FormData();
  data.set("inquiry_id", inquiryId);
  data.set("message_text", text);
  if (file) data.set("attachment", file);
  return data;
}

const pdf = (bytes = 10, name = "a.pdf") => new File([new Uint8Array(bytes)], name, { type: "application/pdf" });

describe("sendMessageWithAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiWrite.mockResolvedValue({
      status: 201,
      data: { message: { id: "m1" }, attachment: { id: "a1", signed_url: "https://api/x" } },
      setCookies: [],
    });
  });

  it("sends text and file together as multipart", async () => {
    const result = await sendMessageWithAttachment(messageForm("see file", pdf()));
    expect(result).toEqual({
      success: true,
      message: { id: "m1" },
      attachment: { id: "a1", signed_url: "https://api/x" },
    });
    const [method, path, body] = apiWrite.mock.calls[0];
    expect([method, path]).toEqual(["POST", `/api/v1/inquiries/${inquiryId}/messages`]);
    expect((body as FormData).get("attachment")).toBeInstanceOf(File);
    expect((body as FormData).get("message_text")).toBe("see file");
  });

  it.each([
    [pdf(3 * 1024 * 1024), "Files must be 2 MB or smaller."],
    [
      new File([new Uint8Array(10)], "a.exe", { type: "application/x-msdownload" }),
      "Attach a JPG, PNG, WebP image or a PDF.",
    ],
  ])("rejects a bad file before calling Laravel", async (file, error) => {
    expect(await sendMessageWithAttachment(messageForm("", file))).toEqual({ error });
    expect(apiWrite).not.toHaveBeenCalled();
  });

  it("rejects an empty message", async () => {
    expect(await sendMessageWithAttachment(messageForm("  "))).toEqual({ error: "Message cannot be empty" });
  });

  it("returns Laravel's message when the thread is not the caller's", async () => {
    apiWrite.mockRejectedValue(new ApiError(404, { code: "not_found", message: "Resource not found." }));
    expect(await sendMessageWithAttachment(messageForm("hi"))).toEqual({ error: "Resource not found." });
  });
});
