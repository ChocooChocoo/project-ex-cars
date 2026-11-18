import type { ActionFailure } from "@/lib/auth/action-result";

import type { ApiErrorBody } from "./types";

/** A Laravel error response, or `api_unavailable` when Laravel could not be reached at all. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? "Request failed.");
    this.name = "ApiError";
    this.status = status;
    this.code = body.code ?? (status === 0 ? "api_unavailable" : "http_error");
    this.fieldErrors = body.fieldErrors;
  }

  /** Auth failures (signed out, inactive, CSRF) are distinct from an outage. */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.status === 419 || this.code === "account_inactive";
  }

  get isOutage(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

export const API_UNAVAILABLE_MESSAGE = "The service is not reachable right now. Please try again shortly.";

/** Normalise any thrown error into the existing ActionFailure contract. */
export function toActionFailure(error: unknown): ActionFailure {
  if (error instanceof ApiError) {
    if (error.isOutage) return { ok: false, code: "api_unavailable", message: API_UNAVAILABLE_MESSAGE };
    return { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors };
  }
  return { ok: false, code: "api_unavailable", message: API_UNAVAILABLE_MESSAGE };
}

/** For the older `{ error: string }` action results. */
export function errorMessage(error: unknown): string {
  return toActionFailure(error).message;
}
