"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { landingPath } from "@/lib/routing/paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const supabase = await createServerSupabase();

  const credentials = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (userId) {
    const { data: roles } = await supabase.rpc("get_user_roles");
    if (roles) {
      const userRole = (roles as { account_id: string; role: string }[]).find((r) => r.account_id === userId);
      if (userRole) {
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

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;

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

export async function createSupplier(params: CreateSupplierParams) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("suppliers")
    .insert({
      supplier_kind: params.supplierKind,
      business_name: params.businessName,
      contact_name: params.contactName,
      contact_email: params.contactEmail,
      contact_phone: params.contactPhone,
      created_by: params.createdBy,
      creation_route: "staff-created",
      state: "pending_approval",
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  await admin.from("audit_events").insert({
    actor_id: params.createdBy,
    action: "supplier_created",
    record_kind: "supplier",
    record_id: data.id,
    summary: `Supplier '${params.businessName}' created (${params.supplierKind})`,
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true, id: data.id };
}

interface ApproveSupplierParams {
  supplierId: string;
  approvedBy: string;
  decision: string;
}

export async function approveSupplier(params: ApproveSupplierParams) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("suppliers")
    .update({
      approval_decision: params.decision,
      approved_by: params.approvedBy,
      approved_at: new Date().toISOString(),
      state: params.decision === "approved" ? "approved" : "rejected",
    })
    .eq("id", params.supplierId);

  if (error) {
    return { error: error.message };
  }

  await admin.from("audit_events").insert({
    actor_id: params.approvedBy,
    action: `supplier_${params.decision}`,
    record_kind: "supplier",
    record_id: params.supplierId,
    summary: `Supplier ${params.supplierId} ${params.decision}`,
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
