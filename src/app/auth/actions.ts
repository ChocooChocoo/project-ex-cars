"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { ApiError, errorMessage } from "@/lib/api/errors";
import { apiWrite, relaySetCookies } from "@/lib/api/server";
import type { Me } from "@/lib/api/types";
import { authorizeAction } from "@/lib/auth/action-guard";
import { EMPLOYEE_ROLES } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/routing/paths";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads/compress-image";
import { emailSchema, fullNameSchema, newPasswordSchema, passwordSchema } from "@/lib/validation/forms";
import { changePasswordSchema, ownProfileSchema, profileAddressColumns } from "@/lib/validation/profile";

// Routing hint only: src/proxy.ts uses it to pick the role prefix. Laravel re-authorises every call.
const ROLE_COOKIE = "gce-role";
const ROLE_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", maxAge: 604800, path: "/" } as const;

export async function signIn(formData: FormData) {
  const parsed = z.object({ email: emailSchema, password: passwordSchema }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials." };
  }

  let me: Me;
  try {
    const result = await apiWrite<Me>("POST", "/api/v1/auth/login", {
      ...parsed.data,
      remember: formData.get("remember") === "on",
    });
    await relaySetCookies(result.setCookies);
    me = result.data;
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath("/", "layout");
  if (!me.role) redirect("/auth/v1/login");
  (await cookies()).set(ROLE_COOKIE, me.role, ROLE_COOKIE_OPTIONS);
  redirect(landingPath(me.role));
}

export async function signUp(formData: FormData) {
  // T04 X1: both policy boxes are required server side too, not only in the form.
  if (formData.get("accept_terms") !== "true" || formData.get("accept_policy") !== "true") {
    return { error: "You must agree to the Terms and Conditions and the Company Policy." };
  }

  const parsed = z.object({ email: emailSchema, password: newPasswordSchema, full_name: fullNameSchema }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid registration details." };
  }

  // Laravel creates user + profile + customer role in one transaction and emails the verification link
  // (to the frontend /auth/confirm, so it works from another device). T04 A3: no session until verified.
  try {
    const result = await apiWrite<{ notice: string }>("POST", "/api/v1/auth/register", {
      ...parsed.data,
      accept_terms: true,
      accept_policy: true,
    });
    await relaySetCookies(result.setCookies);
    return { notice: result.data.notice };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function signOut() {
  try {
    await relaySetCookies((await apiWrite("POST", "/api/v1/auth/logout")).setCookies);
  } catch {
    // Already signed out or Laravel unreachable: still clear this browser's cookies below.
  }
  // The proxy sends "/" to the role landing while this cookie is set, so a stale one bounces a
  // signed-out visitor from the landing page back to the login screen.
  const cookieStore = await cookies();
  cookieStore.delete(ROLE_COOKIE);
  cookieStore.delete("gce_session");
  revalidatePath("/", "layout");
  redirect("/auth/v1/login");
}

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const me = await getSession();
  return me ? { id: me.id, email: me.email } : null;
}

export async function getCurrentRole(): Promise<string | null> {
  return (await getSession())?.role ?? null;
}

interface AssignRoleParams {
  accountId: string;
  role: string;
  /** @deprecated Ignored: Laravel records the signed-in user as the actor. */
  assignedBy?: string;
}

// T03 R2 / T06: CEO and Super Admin grant roles (enforced by Laravel `role:ceo,super_admin`).
export async function assignRole(params: AssignRoleParams) {
  try {
    await apiWrite("POST", "/api/v1/admin/roles", { account_id: params.accountId, role: params.role });
    return { success: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { error: "Not authenticated" };
    if (error instanceof ApiError && error.status === 403) return { error: "Not authorized" };
    return { error: errorMessage(error) };
  }
}

interface CreateWalkInAccountParams {
  email: string;
  password: string;
  fullName: string;
}

const createWalkInAccountSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});

export async function createWalkInAccount(params: CreateWalkInAccountParams) {
  const parsed = createWalkInAccountSchema.safeParse(params);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid walk-in account details." };

  const authorization = await authorizeAction(["account_manager", "ceo"]);
  if (!authorization.ok) return { error: authorization.message };

  // Laravel creates user, profile, role and audit row in one transaction (nothing half-made to undo).
  try {
    await apiWrite("POST", "/api/v1/admin/accounts/walk-in", {
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath("/staff-records");
  return { success: true };
}

const createEmployeeAccountSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  role: z.enum(EMPLOYEE_ROLES as [string, ...string[]], { message: "Choose a staff role." }),
});

// T04 E6: the CEO or the Account Manager creates an account for a new employee. Laravel sets the role,
// profile, default work schedule and audit row in one transaction.
export async function createEmployeeAccount(params: z.input<typeof createEmployeeAccountSchema>) {
  const parsed = createEmployeeAccountSchema.safeParse(params);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid employee account details." };

  const authorization = await authorizeAction(["ceo", "account_manager"]);
  if (!authorization.ok) return { error: authorization.message };

  try {
    await apiWrite("POST", "/api/v1/admin/accounts/employee", {
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role,
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }

  revalidatePath("/staff-records");
  return { success: true };
}

// T03 C15 / T05: the signed-in user's own name, phone and PSGC address, on their own row only (Laravel
// writes to the session user). `address` is composed here from the PSGC names the form sends.
export async function updateOwnProfile(formData: FormData): Promise<{ error: string } | { success: true }> {
  const parsed = ownProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid profile details." };

  try {
    await apiWrite("PATCH", "/api/v1/me/profile", {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      ...profileAddressColumns(parsed.data),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { error: "Not authenticated" };
    return { error: errorMessage(error) };
  }

  revalidatePath("/profile");
  revalidatePath("/my-profile");
  return { success: true };
}

// Forgot password: Laravel emails a link to /auth/v1/reset-password. The answer is the same whether or
// not the email has an account, so the form cannot be used to find out who is registered.
export async function requestPasswordReset(formData: FormData): Promise<{ error: string } | { notice: string }> {
  const parsed = emailSchema.safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please enter a valid email address." };

  try {
    const result = await apiWrite<{ notice: string }>("POST", "/api/v1/auth/password/forgot", { email: parsed.data });
    return { notice: result.data.notice };
  } catch (error) {
    if (error instanceof ApiError && error.code === "rate_limited") {
      return { error: "Too many emails sent. Please wait a few minutes and try again." };
    }
    return { error: errorMessage(error) };
  }
}

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is invalid or has expired."),
    email: emailSchema,
    password: newPasswordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "The new passwords do not match.",
    path: ["confirm_password"],
  });

// Set a new password from the emailed link, then sign in with it.
export async function resetPassword(formData: FormData): Promise<{ error: string }> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };

  try {
    await apiWrite("POST", "/api/v1/auth/password/reset", {
      token: parsed.data.token,
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  redirect("/auth/v1/login?notice=password_reset");
}

// T03 C15: changing the password asks for the current one; Laravel checks it and signs out the
// account's other browsers.
export async function changeOwnPassword(formData: FormData): Promise<{ error: string } | { success: true }> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };

  try {
    const result = await apiWrite("PUT", "/api/v1/me/password", {
      current_password: parsed.data.current_password,
      new_password: parsed.data.new_password,
    });
    await relaySetCookies(result.setCookies);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { error: "Not authenticated" };
    return { error: errorMessage(error) };
  }
  return { success: true };
}

// Test sheet #4 (C15): own profile photo. Laravel stores it under avatars/<user id>/, sniffs the type, enforces
// the 2 MB cap and removes the previous photo. The quick checks here keep the existing messages.
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function avatarRequest(
  method: "POST" | "DELETE",
  body?: FormData,
): Promise<{ error: string } | { success: true }> {
  try {
    await apiWrite(method, "/api/v1/me/avatar", body);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { error: "Not authenticated" };
    if (error instanceof ApiError && error.status === 422)
      return { error: "The photo could not be uploaded. Please try again." };
    return { error: errorMessage(error) };
  }
  revalidatePath("/profile");
  revalidatePath("/my-profile");
  return { success: true };
}

export async function updateOwnAvatar(formData: FormData): Promise<{ error: string } | { success: true }> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };
  if (!AVATAR_TYPES.has(file.type)) return { error: "Use a JPG, PNG or WebP photo." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "The photo must be 2 MB or smaller." };
  const body = new FormData();
  body.set("avatar", file);
  return avatarRequest("POST", body);
}

export async function removeOwnAvatar(): Promise<{ error: string } | { success: true }> {
  return avatarRequest("DELETE");
}

// Test sheet #4 (C15): a customer changes their sign-in email. Laravel emails a signed confirmation link
// to the new address; the email changes when the link is opened (/auth/confirm). Staff emails stay
// managed by the Account Manager and CEO.
export async function requestEmailChange(
  formData: FormData,
): Promise<{ error: string } | { success: true; email: string }> {
  const authorization = await authorizeAction(["customer"]);
  if (!authorization.ok) return { error: authorization.message };

  const parsed = emailSchema.safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please enter a valid email address." };

  try {
    const result = await apiWrite<{ email: string }>("POST", "/api/v1/me/email", { email: parsed.data });
    return { success: true, email: result.data.email };
  } catch (error) {
    if (error instanceof ApiError && error.code === "rate_limited") {
      return { error: "Too many emails sent. Please wait a few minutes and try again." };
    }
    if (error instanceof ApiError && error.code === "validation_error") return { error: error.message };
    return { error: "We could not send the email. Please try again." };
  }
}
