import sharp from "sharp";

import { apiBaseUrl } from "@/lib/api/config";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
// Only Laravel's signed private-file route, and only image files in the two buckets that have previews.
const IMAGE_PATH = /^\/api\/v1\/files\/(transaction-documents|message-attachments)\/.+\.(jpe?g|png|webp)$/i;

function unavailable(status: number) {
  return new Response("Preview unavailable", { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: Request) {
  let source: URL;
  try {
    source = new URL(new URL(request.url).searchParams.get("src") ?? "");
    const decodedPath = decodeURIComponent(source.pathname);
    if (
      source.origin !== new URL(apiBaseUrl()).origin ||
      source.username ||
      source.password ||
      !IMAGE_PATH.test(source.pathname) ||
      decodedPath.split("/").some((part) => part === "." || part === "..") ||
      !source.searchParams.get("signature") ||
      !source.searchParams.get("expires")
    ) {
      return unavailable(400);
    }
  } catch {
    return unavailable(400);
  }

  try {
    // Laravel checks the signature and expiry on every request. Never add credentials or cache past its expiry.
    const response = await fetch(source.href, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return unavailable(404);
    if (Number(response.headers.get("Content-Length")) > MAX_SOURCE_BYTES) return unavailable(413);
    const original = await response.arrayBuffer();
    if (original.byteLength > MAX_SOURCE_BYTES) return unavailable(413);

    const thumbnail = await sharp(original, { limitInputPixels: 64_000_000, autoOrient: true })
      .resize({ width: 640, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75, effort: 2 })
      .toBuffer();

    return new Response(new Uint8Array(thumbnail), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return unavailable(404);
  }
}
