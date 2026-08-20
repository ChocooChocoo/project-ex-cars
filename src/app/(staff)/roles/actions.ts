"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { authorizeAction } from "@/lib/auth/action-guard";
import { RBAC_ACCESS_AREA_KEYS, RBAC_ACTION_KEYS, RBAC_MANAGED_ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const RBAC_STATUSES = ["active", "inactive"] as const;

const roleFormSchema = z.object({
  roleKey: z.enum(RBAC_MANAGED_ROLES),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(RBAC_STATUSES),
  isProtected: z.enum(["true", "false"]).transform((value) => value === "true"),
});

const permissionFormSchema = z.object({
  accessAreaKey: z.enum(RBAC_ACCESS_AREA_KEYS),
  actionKey: z.enum(RBAC_ACTION_KEYS),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(RBAC_STATUSES),
});

const roleUpdateFormSchema = roleFormSchema.extend({
  permissionIds: z.array(z.string().uuid()),
});

type RbacActionResult = { error: string } | { success: true };

async function authorizeRbacManager(): Promise<{ error: string } | { success: true }> {
  const authorization = await authorizeAction(["ceo", "account_manager"]);
  return authorization.ok ? { success: true } : { error: authorization.message };
}

function databaseError(error: { code?: string; message: string }, duplicateMessage: string): RbacActionResult {
  if (error.code === "23505") return { error: duplicateMessage };
  return { error: error.message };
}

export async function createRbacRole(formData: FormData): Promise<RbacActionResult> {
  const authorization = await authorizeRbacManager();
  if ("error" in authorization) return authorization;

  const parsed = roleFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid role details." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("rbac_roles").insert({
    role_key: parsed.data.roleKey,
    description: parsed.data.description || null,
    status: parsed.data.status,
    is_protected: parsed.data.isProtected,
  });
  if (error) return databaseError(error, "That role already exists.");

  revalidatePath("/dashboard/roles");
  return { success: true };
}

export async function createRbacPermission(formData: FormData): Promise<RbacActionResult> {
  const authorization = await authorizeRbacManager();
  if ("error" in authorization) return authorization;

  const parsed = permissionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid permission details." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("rbac_permissions").insert({
    access_area_key: parsed.data.accessAreaKey,
    action_key: parsed.data.actionKey,
    description: parsed.data.description || null,
    status: parsed.data.status,
  });
  if (error) return databaseError(error, "That permission already exists.");

  revalidatePath("/dashboard/roles");
  return { success: true };
}

export async function updateRbacRole(formData: FormData): Promise<RbacActionResult> {
  const authorization = await authorizeRbacManager();
  if ("error" in authorization) return authorization;

  const parsed = roleUpdateFormSchema.safeParse({
    ...Object.fromEntries(formData),
    permissionIds: formData.getAll("permissionIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid role details." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_rbac_role", {
    p_role_key: parsed.data.roleKey,
    p_description: parsed.data.description || null,
    p_status: parsed.data.status,
    p_is_protected: parsed.data.isProtected,
    p_permission_ids: [...new Set(parsed.data.permissionIds)],
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/roles");
  return { success: true };
}
