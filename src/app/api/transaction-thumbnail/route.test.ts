// @vitest-environment node

import sharp from "sharp";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const origin = "https://project.supabase.co";
const source = `${origin}/storage/v1/object/sign/transaction-documents/car.jpg?token=example`;
const fetchImage = vi.fn<typeof fetch>();
let original: Uint8Array<ArrayBuffer>;

function request(src = source) {
  return new Request(`https://app.test/api/transaction-thumbnail?src=${encodeURIComponent(src)}`);
}

beforeAll(async () => {
  original = new Uint8Array(
    await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#888888" } })
      .jpeg()
      .toBuffer(),
  );
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", origin);
  vi.stubGlobal("fetch", fetchImage);
  fetchImage.mockReset();
  fetchImage.mockResolvedValue(new Response(original, { headers: { "Content-Type": "image/jpeg" } }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/transaction-thumbnail", () => {
  it("returns an uncropped 640x480 thumbnail without caching private documents", async () => {
    const response = await GET(request());
    const thumbnail = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(thumbnail).metadata();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(480);
    expect(thumbnail.byteLength).toBeLessThan(original.byteLength);
    expect(fetchImage).toHaveBeenCalledExactlyOnceWith(
      source,
      expect.objectContaining({ cache: "no-store", redirect: "error" }),
    );
  });

  it("allows signed chat images used by the same preview component", async () => {
    const response = await GET(request(source.replace("transaction-documents", "message-attachments")));
    expect(response.status).toBe(200);
  });

  it.each([
    "https://attacker.test/storage/v1/object/sign/transaction-documents/car.jpg?token=example",
    `${origin}:444/storage/v1/object/sign/transaction-documents/car.jpg?token=example`,
    `${origin}/storage/v1/object/public/transaction-documents/car.jpg?token=example`,
    `${origin}/storage/v1/object/sign/other-bucket/car.jpg?token=example`,
    `${origin}/storage/v1/object/sign/transaction-documents/car.jpg`,
    `${origin}/storage/v1/object/sign/transaction-documents/car.svg?token=example`,
    `${origin}/storage/v1/object/sign/transaction-documents/%2e%2e%2fauth.jpg?token=example`,
    "not-a-url",
  ])("rejects unapproved image source %s before fetching", async (src) => {
    const response = await GET(request(src));
    expect(response.status).toBe(400);
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("does not bypass expired or revoked signed links", async () => {
    fetchImage.mockResolvedValue(new Response("Expired", { status: 403 }));
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("handles upstream failure without returning the original image", async () => {
    fetchImage.mockRejectedValue(new Error("timeout"));
    expect((await GET(request())).status).toBe(404);
  });

  it("rejects invalid image contents", async () => {
    fetchImage.mockResolvedValue(new Response("broken image", { headers: { "Content-Type": "image/jpeg" } }));
    expect((await GET(request())).status).toBe(404);
  });

  it("rejects oversized originals before decoding", async () => {
    fetchImage.mockResolvedValue(
      new Response(original, { headers: { "Content-Type": "image/jpeg", "Content-Length": String(21 * 1024 * 1024) } }),
    );
    expect((await GET(request())).status).toBe(413);
  });
});
