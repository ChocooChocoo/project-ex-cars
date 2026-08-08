"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { ACCEPTED_ID_TYPES } from "@/lib/auth/roles";
import { landingPath } from "@/lib/routing/paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { emailSchema, fullNameSchema, passwordSchema } from "@/lib/validation/forms";

export async function signIn(formData: FormData) {
  const supabase = await createServerSupabase();

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
  const supabase = await createServerSupabase();

  const parsed = z.object({ email: emailSchema, password: passwordSchema, full_name: fullNameSchema }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid registration details." };
  }

  const { email, password, full_name: fullName } = parsed.data;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ full_name: fullName }).eq("id", data.user.id);

    const cookieStore = await cookies();
    cookieStore.set("gce-role", "customer", { httpOnly: true, sameSite: "lax", maxAge: 604800, path: "/" });
  }

  revalidatePath("/", "layout");
  redirect("/customer/showroom");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/v1/login");
}

export async function getCurrentUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentRole(): Promise<string | null> {
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
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) => ["ceo", "account_manager"].includes(r.role));
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
  createdBy: string;
}

export async function createWalkInAccount(params: CreateWalkInAccountParams) {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: roles } = await supabase.rpc("get_user_roles");
  const hasRole = (roles as { role: string }[] | undefined)?.some((r) =>
    ["ceo", "account_manager", "sales_manager"].includes(r.role),
  );
  if (!hasRole) return { error: "Not authorized" };

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { full_name: params.fullName },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await admin
      .from("profiles")
      .update({
        full_name: params.fullName,
        account_state: "active",
        created_by: params.createdBy,
        activated_at: new Date().toISOString(),
      })
      .eq("id", data.user.id);

    await admin.from("audit_events").insert({
      actor_id: params.createdBy,
      action: "walk_in_account_created",
      record_kind: "profile",
      record_id: data.user.id,
      summary: `Walk-in account created for ${params.fullName} (${params.email})`,
    });
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}

interface CreateSupplierParams {
  supplierKind: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdBy: string;
}

const createSupplierSchema = z.object({
  supplierKind: z.enum(["company", "individual"]),
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
  const { supplierKind, businessName, contactName, contactEmail, contactPhone, createdBy } = parsed.data;

  const supabase = await createServerSupabase();
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
    summary: `Supplier '${businessName}' created (${supplierKind})`,
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

  const supabase = await createServerSupabase();
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
  const supabase = await createServerSupabase();
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

  const supabase = await createServerSupabase();
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
  const supabase = await createServerSupabase();
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

  revalidatePath("/dashboard/profile");
  return { success: true };
}
