import sharp from "sharp";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const IMAGE_PATH = /^\/storage\/v1\/object\/sign\/(transaction-documents|message-attachments)\/.+\.(jpe?g|png|webp)$/i;

function unavailable(status: number) {
  return new Response("Preview unavailable", { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: Request) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) return unavailable(503);

  let source: URL;
  try {
    source = new URL(new URL(request.url).searchParams.get("src") ?? "");
    const decodedPath = decodeURIComponent(source.pathname);
    if (
      source.origin !== new URL(projectUrl).origin ||
      source.username ||
      source.password ||
      !IMAGE_PATH.test(source.pathname) ||
      decodedPath.split("/").some((part) => part === "." || part === "..") ||
      !source.searchParams.get("token")
    ) {
      return unavailable(400);
    }
  } catch {
    return unavailable(400);
  }

  try {
    // Storage validates the existing bearer token on every request. Never use an admin key or cache past its expiry.
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
