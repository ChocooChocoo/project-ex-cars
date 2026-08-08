export type ActionFailure = {
  ok: false;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = undefined> = { ok: true; data: T } | ActionFailure;

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function successEmpty(): ActionResult<undefined> {
  return { ok: true, data: undefined };
}

export function failure(code: string, message: string, fieldErrors?: Record<string, string[]>): ActionFailure {
  return { ok: false, code, message, fieldErrors };
}

export function notAuthenticated(): ActionFailure {
  return { ok: false, code: "not_authenticated", message: "You must be signed in." };
}

export function notAuthorized(message?: string): ActionFailure {
  return { ok: false, code: "not_authorized", message: message ?? "You do not have permission for this action." };
}

export function notFound(resource?: string): ActionFailure {
  return { ok: false, code: "not_found", message: resource ? `${resource} not found.` : "Resource not found." };
}

export function validationError(message: string, fieldErrors?: Record<string, string[]>): ActionFailure {
  return { ok: false, code: "validation_error", message, fieldErrors };
}
