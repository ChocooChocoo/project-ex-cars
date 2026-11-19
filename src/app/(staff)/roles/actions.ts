"use client";

import { z } from "zod";

import { apiAction } from "@/lib/api/action";
import { RBAC_ACCESS_AREA_KEYS, RBAC_ACTION_KEYS, RBAC_MANAGED_ROLES } from "@/lib/auth/roles";

// Phase 7: browser adapters for the Laravel RBAC endpoints (AdminController, CEO and Super Admin).

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

async function done(path: string, body: unknown): Promise<RbacActionResult> {
  const result = await apiAction(path, body);
  return result.error !== undefined ? { error: result.error } : { success: true };
}

export async function createRbacRole(formData: FormData): Promise<RbacActionResult> {
  const parsed = roleFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid role details." };
  return done("/admin/rbac/roles", {
    role_key: parsed.data.roleKey,
    description: parsed.data.description || null,
    status: parsed.data.status,
    is_protected: parsed.data.isProtected,
  });
}

export async function createRbacPermission(formData: FormData): Promise<RbacActionResult> {
  const parsed = permissionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid permission details." };
  return done("/admin/rbac/permissions", {
    access_area_key: parsed.data.accessAreaKey,
    action_key: parsed.data.actionKey,
    description: parsed.data.description || null,
    status: parsed.data.status,
  });
}

export async function updateRbacRole(formData: FormData): Promise<RbacActionResult> {
  const parsed = roleUpdateFormSchema.safeParse({
    ...Object.fromEntries(formData),
    permissionIds: formData.getAll("permissionIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid role details." };
  return done("/admin/rbac/roles/update", {
    role_key: parsed.data.roleKey,
    description: parsed.data.description || null,
    status: parsed.data.status,
    is_protected: parsed.data.isProtected,
    permission_ids: [...new Set(parsed.data.permissionIds)],
  });
}
