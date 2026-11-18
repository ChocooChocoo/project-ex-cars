import { apiBaseUrl, XSRF_COOKIE } from "./config";
import { ApiError } from "./errors";

/**
 * Browser-side Laravel client: sends the session cookie (credentials: include) and the XSRF
 * header Sanctum expects on writes. Contains no server-only cookie handling.
 */
function readXsrf(): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${XSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(XSRF_COOKIE.length + 1)) : null;
}

async function ensureCsrf(): Promise<void> {
  if (readXsrf()) return;
  await fetch(`${apiBaseUrl()}/sanctum/csrf-cookie`, { credentials: "include" });
}

export async function browserApi<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  if (method !== "GET") await ensureCsrf();
  const headers: Record<string, string> = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
  const xsrf = readXsrf();
  if (xsrf && method !== "GET") headers["X-XSRF-TOKEN"] = xsrf;
  // FormData (file uploads) sets its own multipart boundary.
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : multipart ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { message: "Laravel API unreachable" });
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(response.status, data ?? {});
  return data as T;
}
