"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/action-guard";
import { ACCEPTED_ID_TYPES, EMPLOYEE_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { landingPath } from "@/lib/routing/paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase, createServerSupabaseClient } from "@/lib/supabase/server";
import { emailSchema, fullNameSchema, newPasswordSchema, passwordSchema } from "@/lib/validation/forms";
import { changePasswordSchema, ownProfileSchema } from "@/lib/validation/profile";

export async function signIn(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const parsed = z.object({ email: emailSchema, password: passwordSchema }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials." };
  }

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (userId) {
    const { data: roles } = await supabase.rpc("get_user_roles");
    if (roles) {
      const userRole = (roles as { account_id: string; role: string }[]).find((r) => r.account_id === userId);
      if (userRole) {
        if (userRole.role === "supplier") {
          const admin = createAdminClient();
          const { data: supplier } = await admin
            .from("suppliers")
            .select("id, state, account_id")
            .eq("contact_email", parsed.data.email)
            .order("created_at", { ascending: false })
            .maybeSingle();

          if (!supplier) {
            return { error: "No supplier record found for this account. Please contact GCE." };
          }
          if (supplier.state !== "approved") {
            return {
              error: "Your supplier account is pending approval. You will be able to sign in once GCE approves it.",
            };
          }
          if (supplier.account_id !== userId) {
            await admin.from("suppliers").update({ account_id: userId }).eq("id", supplier.id);
          }
        }
        const cookieStore = await cookies();
        cookieStore.set("gce-role", userRole.role, { httpOnly: true, sameSite: "lax", maxAge: 604800, path: "/" });
        revalidatePath("/", "layout");
        redirect(landingPath(userRole.role));
      }
    }
  }

  revalidatePath("/", "layout");
  redirect("/auth/v1/login");
}

export async function signUp(formData: FormData) {
  const supabase = await createServerSupabaseClient();

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

  const { email, password, full_name: fullName } = parsed.data;
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // The handle_new_user trigger creates the profile from the full_name metadata.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { full_name: fullName, terms_accepted_at: new Date().toISOString() },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // With confirmations on, Supabase hides an existing email by returning a user with no identities.
  if (data.user?.identities?.length === 0) {
    return { error: "This email is already registered. Please log in instead." };
  }

  // T04 A3: no session means the email still needs verifying; the callback signs the user in later.
  if (!data.session) {
    return { notice: "Check your email to verify your account." };
  }

  const cookieStore = await cookies();
  cookieStore.set("gce-role", "customer", { httpOnly: true, sameSite: "lax", maxAge: 604800, path: "/" });

  revalidatePath("/", "layout");
  redirect("/customer/showroom");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/v1/login");
}

export async function getCurrentUser() {
  // Read-only client for the same reason as getCurrentRole: this is called from Server
  // Component renders (e.g. the staff suppliers page), where a cookie write throws.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentRole(): Promise<string | null> {
  // Read-only client: this runs during Server Component renders, where Next.js throws
  // on any cookie write. The read-write client refreshes and persists the rotated
  // token, which made an expired access token a 500 instead of a page. src/proxy.ts
  // now owns the refresh, so renders only ever read.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: roles } = await supabase.rpc("get_user_roles");
  if (!roles) return null;

  const userRole = (roles as { account_id: string; role: string }[]).find((r) => r.account_id === user.id);
  return userRole?.role ?? null;
}

interface AssignRoleParams {
  accountId: string;
  role: string;
  assignedBy: string;
}

export async function assignRole(params: AssignRoleParams) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  // T03 R2: only the CEO grants roles; the Account Manager manages employees without RBAC access.
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => r.role === "ceo");
  if (!hasRole) return { error: "Not authorized" };

  const admin = createAdminClient();

  const { error } = await admin.rpc("assign_user_role", {
    p_account_id: params.accountId,
    p_role: params.role,
    p_assigned_by: params.assignedBy,
  });

  if (error) {
    return { error: error.message };
  }

  await admin.from("audit_events").insert({
    actor_id: params.assignedBy,
    action: "role_assigned",
    record_kind: "user_role",
    record_id: params.accountId,
    summary: `Role '${params.role}' assigned to account ${params.accountId}`,
  });

  return { success: true };
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
  const actorId = authorization.data.userId;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (error) return { error: error.message };
  const createdUserId = data.user?.id;
  if (!createdUserId) return { error: "The walk-in account could not be created." };

  const profileResult = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      account_state: "active",
      created_by: actorId,
      activated_at: new Date().toISOString(),
    })
    .eq("id", createdUserId);

  if (profileResult.error) {
    await admin.auth.admin.deleteUser(createdUserId);
    return { error: profileResult.error.message };
  }

  const auditResult = await admin.from("audit_events").insert({
    actor_id: actorId,
    action: "walk_in_account_created",
    record_kind: "profile",
    record_id: createdUserId,
    summary: `Walk-in account created for ${parsed.data.fullName} (${parsed.data.email})`,
  });

  if (auditResult.error) {
    await admin.auth.admin.deleteUser(createdUserId);
    return { error: auditResult.error.message };
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

// T04 E6: the CEO or the Account Manager creates an account for a new employee. The role is set by
// set_new_employee_role (service role only), which only turns a fresh account into a staff account.
export async function createEmployeeAccount(params: z.input<typeof createEmployeeAccountSchema>) {
  const parsed = createEmployeeAccountSchema.safeParse(params);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid employee account details." };

  const authorization = await authorizeAction(["ceo", "account_manager"]);
  if (!authorization.ok) return { error: authorization.message };
  const actorId = authorization.data.userId;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error) return { error: error.message };
  const createdUserId = data.user?.id;
  if (!createdUserId) return { error: "The employee account could not be created." };

  // Any failure after this point removes the half-made account, so a retry with the same email works.
  const undo = async (message: string) => {
    await admin.auth.admin.deleteUser(createdUserId);
    return { error: message };
  };

  const roleResult = await admin.rpc("set_new_employee_role", {
    p_account_id: createdUserId,
    p_role: parsed.data.role,
    p_assigned_by: actorId,
  });
  if (roleResult.error) return undo(roleResult.error.message);

  const profileResult = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      account_state: "active",
      created_by: actorId,
      activated_at: new Date().toISOString(),
    })
    .eq("id", createdUserId);
  if (profileResult.error) return undo(profileResult.error.message);

  const roleLabel = ROLE_LABELS[parsed.data.role as keyof typeof ROLE_LABELS];
  const auditResult = await admin.from("audit_events").insert({
    actor_id: actorId,
    action: "employee_account_created",
    record_kind: "profile",
    record_id: createdUserId,
    summary: `${roleLabel} account created for ${parsed.data.fullName} (${parsed.data.email})`,
  });
  if (auditResult.error) return undo(auditResult.error.message);

  revalidatePath("/staff-records");
  return { success: true };
}

interface CreateSupplierParams {
  supplierKind: string;
  supplierOffering?: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdBy: string;
}

const createSupplierSchema = z.object({
  supplierKind: z.enum(["company", "individual"]),
  supplierOffering: z.enum(["vehicle", "parts", "both"]).default("parts"),
  businessName: z.string().min(1, "Business name is required.").max(200),
  contactName: z.string().min(1, "Contact name is required.").max(200),
  contactEmail: z.string().email("A valid contact email is required."),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  createdBy: z.string().uuid(),
});

export async function createSupplier(params: CreateSupplierParams) {
  const parsed = createSupplierSchema.safeParse(params);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid supplier details." };
  }
  const { supplierKind, supplierOffering, businessName, contactName, contactEmail, contactPhone, createdBy } =
    parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["ceo", "account_manager"].includes(r.role));
  if (!hasRole) return { error: "Not authorized" };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("suppliers")
    .insert({
      supplier_kind: supplierKind,
      supplier_offering: supplierOffering,
      business_name: businessName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      created_by: createdBy,
      creation_route: "staff-created",
      state: "pending_approval",
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  await admin.from("audit_events").insert({
    actor_id: createdBy,
    action: "supplier_created",
    record_kind: "supplier",
    record_id: data.id,
    summary: `Supplier '${businessName}' created (${supplierKind}, ${supplierOffering})`,
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true, id: data.id };
}

interface ApproveSupplierParams {
  supplierId: string;
  approvedBy: string;
  decision: string;
}

const approveSupplierSchema = z.object({
  supplierId: z.string().uuid(),
  approvedBy: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export async function approveSupplier(params: ApproveSupplierParams) {
  const parsed = approveSupplierSchema.safeParse(params);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid approval request." };
  }
  const { supplierId, approvedBy, decision } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["ceo", "account_manager"].includes(r.role));
  if (!hasRole) return { error: "Not authorized" };

  const admin = createAdminClient();

  const { data: supplier } = await admin.from("suppliers").select("state").eq("id", supplierId).maybeSingle();
  if (!supplier) return { error: "Supplier not found." };
  if (supplier.state !== "pending_approval") {
    return {
      error: `Supplier cannot be ${decision} from state '${supplier.state}'. Only pending approvals can be decided.`,
    };
  }

  if (decision === "approved") {
    const { count } = await admin
      .from("supplier_documents")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId)
      .eq("is_primary_id", true)
      .eq("verification_state", "verified");
    if ((count ?? 0) < 2) {
      return { error: "Two primary valid IDs must be uploaded and verified before approval." };
    }
  }

  const { error } = await admin
    .from("suppliers")
    .update({
      approval_decision: decision,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      state: decision,
    })
    .eq("id", supplierId);

  if (error) {
    return { error: error.message };
  }

  await admin.from("audit_events").insert({
    actor_id: approvedBy,
    action: `supplier_${decision}`,
    record_kind: "supplier",
    record_id: supplierId,
    summary: `Supplier ${supplierId} ${decision}`,
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function uploadSupplierDocument(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) =>
    ["ceo", "account_manager", "head_accountant"].includes(r.role),
  );
  if (!hasRole) return { error: "Not authorized" };

  const supplierId = formData.get("supplier_id") as string;
  const documentKind = formData.get("document_kind") as string;
  const isPrimaryId = formData.get("is_primary_id") === "true";
  const file = formData.get("file") as File | null;

  if (!supplierId || !file?.size) {
    return { error: "Supplier and a file are required." };
  }
  if (documentKind && !ACCEPTED_ID_TYPES.includes(documentKind as (typeof ACCEPTED_ID_TYPES)[number])) {
    return { error: "Unsupported document kind." };
  }

  const fileExt = file.name.split(".").pop() ?? "bin";
  const filePath = `${supplierId}/${documentKind || "document"}-${Date.now()}.${fileExt}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from("supplier-documents").upload(filePath, file);
  if (uploadError) return { error: uploadError.message };

  const { error: dbError } = await admin.from("supplier_documents").insert({
    supplier_id: supplierId,
    document_kind: documentKind || "general",
    is_primary_id: isPrimaryId,
    storage_path: filePath,
  });
  if (dbError) return { error: dbError.message };

  await admin.from("audit_events").insert({
    actor_id: user.user.id,
    action: "supplier_document_uploaded",
    record_kind: "supplier_document",
    record_id: supplierId,
    summary: `Document '${documentKind || "general"}' uploaded for supplier ${supplierId}`,
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

interface VerifySupplierDocumentParams {
  documentId: string;
  decision: "verified" | "rejected";
  verifiedBy: string;
}

export async function verifySupplierDocument(params: VerifySupplierDocumentParams) {
  const parsed = z
    .object({
      documentId: z.string().uuid(),
      decision: z.enum(["verified", "rejected"]),
      verifiedBy: z.string().uuid(),
    })
    .safeParse(params);
  if (!parsed.success) return { error: "Invalid verification request." };
  const { documentId, decision, verifiedBy } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["ceo", "account_manager"].includes(r.role));
  if (!hasRole) return { error: "Not authorized" };

  const admin = createAdminClient();
  const { data: doc } = await admin.from("supplier_documents").select("supplier_id").eq("id", documentId).maybeSingle();
  if (!doc) return { error: "Document not found." };

  const { error } = await admin
    .from("supplier_documents")
    .update({
      verification_state: decision,
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (error) return { error: error.message };

  await admin.from("audit_events").insert({
    actor_id: verifiedBy,
    action: `supplier_document_${decision}`,
    record_kind: "supplier_document",
    record_id: doc.supplier_id,
    summary: `Supplier document ${documentId} marked ${decision}`,
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function uploadCustomerDocument(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const file = formData.get("file") as File;
  const documentKind = formData.get("document_kind") as string;

  if (!file || !documentKind) {
    return { error: "File and document kind are required" };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${user.id}/${documentKind}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from("customer-documents").upload(filePath, file);

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: dbError } = await supabase.from("customer_documents").insert({
    customer_id: user.id,
    document_kind: documentKind,
    storage_path: filePath,
  });

  if (dbError) {
    return { error: dbError.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

// T03 C15: the signed-in user's own name, phone and address. Only these columns are written, on their own
// row (RLS "Users can update own profile"); the auth display name follows the full name.
export async function updateOwnProfile(formData: FormData): Promise<{ error: string } | { success: true }> {
  const parsed = ownProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid profile details." };

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
    })
    .eq("id", user.user.id);
  if (error) return { error: error.message };

  await supabase.auth.updateUser({ data: { full_name: parsed.data.full_name } });

  revalidatePath("/profile");
  revalidatePath("/my-profile");
  return { success: true };
}

// T03 C15: changing the password asks for the current one, checked on a separate client so the
// user's session cookies are not touched by the check.
export async function changeOwnPassword(formData: FormData): Promise<{ error: string } | { success: true }> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user?.email) return { error: "Not authenticated" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { error: "Password change is not available right now." };
  const checker = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: checkError } = await checker.auth.signInWithPassword({
    email: user.user.email,
    password: parsed.data.current_password,
  });
  if (checkError) return { error: "Your current password is not correct." };
  await checker.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) return { error: error.message };
  return { success: true };
}

// Test sheet #4 (C15): own profile photo, stored at avatars/<user id>/ (storage rules allow only that folder).
const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

function avatarPath(url: string | null | undefined) {
  const marker = "/storage/v1/object/public/avatars/";
  const at = url?.indexOf(marker) ?? -1;
  return url && at >= 0 ? decodeURIComponent(url.slice(at + marker.length)) : null;
}

async function saveOwnAvatar(avatarUrl: string | null): Promise<{ error: string } | { success: true }> {
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.user.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.user.id);
  if (error) return { error: error.message };
  await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });

  const oldPath = avatarPath(profile?.avatar_url);
  if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);

  revalidatePath("/profile");
  revalidatePath("/my-profile");
  return { success: true };
}

export async function updateOwnAvatar(formData: FormData): Promise<{ error: string } | { success: true }> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };
  const ext = AVATAR_TYPES[file.type];
  if (!ext) return { error: "Use a JPG, PNG or WebP photo." };
  if (file.size > AVATAR_MAX_BYTES) return { error: "The photo must be 2 MB or smaller." };

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };

  const path = `${user.user.id}/avatar-${Date.now()}.${ext}`;
  const bucket = supabase.storage.from("avatars");
  const { error } = await bucket.upload(path, file, { contentType: file.type });
  if (error) return { error: "The photo could not be uploaded. Please try again." };

  const result = await saveOwnAvatar(bucket.getPublicUrl(path).data.publicUrl);
  if ("error" in result) await bucket.remove([path]);
  return result;
}

export async function removeOwnAvatar(): Promise<{ error: string } | { success: true }> {
  return saveOwnAvatar(null);
}

// Test sheet #4 (C15): a customer changes their sign-in email. Supabase emails a confirmation link to
// the new address; the email changes when the link is opened. Staff emails stay managed by the
// Account Manager and CEO.
function emailChangeError(error: { code?: string; status?: number; message: string }) {
  if (error.code === "email_exists" || /already (been )?registered/i.test(error.message)) {
    return "This email is already used by another account.";
  }
  if (error.status === 429 || error.code?.startsWith("over_")) {
    return "Too many emails sent. Please wait a few minutes and try again.";
  }
  return "We could not send the email. Please try again.";
}

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

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Not authenticated" };
  if (parsed.data === user.user.email?.toLowerCase()) return { error: "This is already your email." };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/customer/profile")}` },
  );
  if (error) return { error: emailChangeError(error) };
  return { success: true, email: parsed.data };
}
