"use client";

import { browserApi } from "./client";
import { errorMessage } from "./errors";
import { revalidatePath } from "./revalidate";

/**
 * The `{ error }` / `{ success, ... }` results the Phase 5 actions kept from their Server Action days. The error
 * branch lists the success fields as undefined, as TypeScript inferred for the old object-literal returns, so the
 * components' `result.error` and `result.id` reads keep type-checking.
 */
export type ActionResult<T extends object = object> =
  | ({ error: string; success?: undefined } & { [K in keyof T]?: undefined })
  | ({ success: true; error?: undefined } & T);

/**
 * Runs one Laravel action endpoint. Laravel answers with the old action's success shape; a refused step
 * (4xx) or an outage becomes `{ error }`. A success reloads every mounted page, like revalidatePath did.
 */
export async function apiAction<T extends object = object>(
  path: string,
  body?: unknown,
  method: "POST" | "DELETE" = "POST",
): Promise<ActionResult<T>> {
  try {
    const result = await browserApi<{ success: true } & T>(method, `/api/v1${path}`, body);
    revalidatePath("/");
    return result as ActionResult<T>;
  } catch (error) {
    return { error: errorMessage(error) } as ActionResult<T>;
  }
}

/** PHP keeps only the last of repeated form keys, so a key sent more than once goes as `key[]`. */
export function laravelForm(formData: FormData): FormData {
  const counts = new Map<string, number>();
  for (const key of formData.keys()) counts.set(key, (counts.get(key) ?? 0) + 1);
  const out = new FormData();
  for (const [key, value] of formData.entries()) out.append((counts.get(key) ?? 0) > 1 ? `${key}[]` : key, value);
  return out;
}
