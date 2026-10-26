import { beforeEach, describe, expect, it, vi } from "vitest";

const { messageInsert, attachmentInsert, inquiryLookup, remove, createSignedUploadUrl, createSignedUrl } = vi.hoisted(
  () => ({
    messageInsert: vi.fn(),
    attachmentInsert: vi.fn(),
    inquiryLookup: vi.fn(),
    remove: vi.fn(),
    createSignedUploadUrl: vi.fn(),
    createSignedUrl: vi.fn(),
  }),
);

const userId = "11111111-1111-4111-8111-111111111111";
const inquiryId = "22222222-2222-4222-8222-222222222222";
const messageId = "33333333-3333-4333-8333-333333333333";

const single = (fn: ReturnType<typeof vi.fn>) => ({ select: () => ({ single: fn }) });

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } } })) },
    from: vi.fn((table: string) => {
      if (table === "inquiry_messages")
        return {
          insert: (row: unknown) => {
            messageInsert(row);
            return single(vi.fn(async () => ({ data: { id: messageId }, error: null })));
          },
        };
      if (table === "message_attachments")
        return { insert: (row: unknown) => single(vi.fn(async () => attachmentInsert(row))) };
      return { select: () => ({ eq: () => ({ maybeSingle: inquiryLookup }) }) };
    }),
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ remove, createSignedUploadUrl, createSignedUrl }) } }),
}));

import { prepareMessageAttachment, sendMessageWithAttachment } from "./actions";

function messageForm(extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("inquiry_id", inquiryId);
  fd.set("message_text", "Here is the photo");
  for (const [key, value] of Object.entries(extra)) fd.set(key, value);
  return fd;
}

const fileFields = {
  attachment_path: `${inquiryId}/abc.jpg`,
  attachment_name: "front.jpg",
  attachment_type: "image/jpeg",
  attachment_size: String(5 * 1024 * 1024),
};

beforeEach(() => {
  vi.clearAllMocks();
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/front.jpg" } });
});

describe("prepareMessageAttachment", () => {
  it("refuses a file over 10 MB or of another type before touching storage", async () => {
    expect(
      await prepareMessageAttachment(inquiryId, { name: "big.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 }),
    ).toEqual({ error: "Files must be 10 MB or smaller." });
    expect(
      await prepareMessageAttachment(inquiryId, { name: "a.exe", type: "application/x-msdownload", size: 10 }),
    ).toEqual({
      error: "Attach a JPG, PNG, WebP image or a PDF.",
    });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses a thread the caller cannot read", async () => {
    inquiryLookup.mockResolvedValue({ data: null });
    expect(await prepareMessageAttachment(inquiryId, { name: "a.pdf", type: "application/pdf", size: 10 })).toEqual({
      error: "You cannot send files in this conversation.",
    });
  });

  it("returns a signed upload inside the thread's folder", async () => {
    inquiryLookup.mockResolvedValue({ data: { id: inquiryId } });
    createSignedUploadUrl.mockImplementation(async (path: string) => ({ data: { path, token: "t" }, error: null }));

    const result = await prepareMessageAttachment(inquiryId, { name: "a.pdf", type: "application/pdf", size: 10 });
    expect(result).toMatchObject({ token: "t" });
    expect((result as { path: string }).path).toMatch(new RegExp(`^${inquiryId}/[0-9a-f-]{36}\\.pdf$`));
  });
});

describe("sendMessageWithAttachment", () => {
  it("records the attachment with the sender as uploader and returns it signed", async () => {
    attachmentInsert.mockImplementation((row) => ({ data: { id: "att-1", ...row }, error: null }));

    const result = await sendMessageWithAttachment(messageForm(fileFields));

    expect(attachmentInsert).toHaveBeenCalledWith({
      message_id: messageId,
      file_kind: "image",
      storage_path: `${inquiryId}/abc.jpg`,
      original_name: "front.jpg",
      file_size: 5 * 1024 * 1024,
      uploader_id: userId,
    });
    expect(result).toMatchObject({
      success: true,
      attachment: { id: "att-1", signed_url: "https://signed/front.jpg" },
    });
    expect((result as { attachment: Record<string, unknown> }).attachment).not.toHaveProperty("storage_path");
  });

  it("returns the error and removes the upload when the attachment row fails", async () => {
    attachmentInsert.mockReturnValue({ data: null, error: { message: "new row violates row-level security policy" } });

    const result = await sendMessageWithAttachment(messageForm(fileFields));

    expect(result).toEqual({
      error: "Your message was sent, but the file was not: new row violates row-level security policy",
    });
    expect(remove).toHaveBeenCalledWith([`${inquiryId}/abc.jpg`]);
  });

  it("refuses a path outside the thread's folder", async () => {
    const result = await sendMessageWithAttachment(messageForm({ ...fileFields, attachment_path: "other/abc.jpg" }));
    expect(result).toEqual({ error: "Invalid attachment. Please attach the file again." });
    expect(messageInsert).not.toHaveBeenCalled();
  });
});
