import { requireRole } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";

import { type RbacCatalogOption, type RbacPermission, type RbacRole, Roles } from "./_components/roles";

interface ProfileRow {
  id: string;
  full_name: string | null;
  account_state: string;
  created_at: string;
}

interface UserRoleRow {
  account_id: string;
  role: string;
}

interface RoleRow {
  role_key: RbacRole["roleKey"];
  description: string | null;
  status: RbacRole["status"];
  is_protected: boolean;
}

interface PermissionRow {
  id: string;
  access_area_key: string;
  action_key: string;
  access_label: string;
  permission_key: string;
  description: string | null;
  status: RbacPermission["status"];
}

interface CatalogRow {
  key: string;
  label: string;
  sort_order: number;
}

interface AssignmentRow {
  role_key: RbacRole["roleKey"];
  permission_id: string;
}

export default async function Page() {
  await requireRole(["ceo", "account_manager"]);
  const supabase = await createServerSupabase();

  const [
    profilesResult,
    userRolesResult,
    rolesResult,
    permissionsResult,
    areasResult,
    actionsResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, account_state, created_at"),
    supabase.rpc("get_all_user_roles"),
    supabase.from("rbac_roles").select("role_key, description, status, is_protected").order("role_key"),
    supabase
      .from("rbac_permissions")
      .select("id, access_area_key, action_key, access_label, permission_key, description, status")
      .order("permission_key"),
    supabase.from("rbac_access_areas").select("key, label, sort_order").order("sort_order"),
    supabase.from("rbac_actions").select("key, label, sort_order").order("sort_order"),
    supabase.from("rbac_role_permissions").select("role_key, permission_id"),
  ]);

  const failures = [
    profilesResult,
    userRolesResult,
    rolesResult,
    permissionsResult,
    areasResult,
    actionsResult,
    assignmentsResult,
  ]
    .map((result) => result.error?.message)
    .filter(Boolean);
  const dataError = failures.length ? `Unable to load RBAC data: ${failures.join("; ")}` : null;

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const userRoles = (userRolesResult.data ?? []) as UserRoleRow[];
  const roleRows = (rolesResult.data ?? []) as RoleRow[];
  const permissionRows = (permissionsResult.data ?? []) as PermissionRow[];
  const assignmentRows = (assignmentsResult.data ?? []) as AssignmentRow[];
  const assignmentsByRole = new Map<string, string[]>();
  for (const assignment of assignmentRows) {
    assignmentsByRole.set(assignment.role_key, [
      ...(assignmentsByRole.get(assignment.role_key) ?? []),
      assignment.permission_id,
    ]);
  }

  const users = profiles.map((profile) => {
    const roleRecord = userRoles.find((role) => role.account_id === profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name ?? "Unknown",
      accountState: profile.account_state,
      role: roleRecord?.role ?? "customer",
      createdAt: profile.created_at,
    };
  });

  const roles: RbacRole[] = roleRows.map((role) => ({
    roleKey: role.role_key,
    description: role.description,
    status: role.status,
    isProtected: role.is_protected,
    permissionIds: assignmentsByRole.get(role.role_key) ?? [],
  }));
  const permissions: RbacPermission[] = permissionRows.map((permission) => ({
    id: permission.id,
    accessAreaKey: permission.access_area_key,
    actionKey: permission.action_key,
    accessLabel: permission.access_label,
    permissionKey: permission.permission_key,
    description: permission.description,
    status: permission.status,
  }));
  const toCatalog = (rows: unknown) =>
    (rows as CatalogRow[]).map((row) => ({ key: row.key, label: row.label, sortOrder: row.sort_order }));

  return (
    <Roles
      actions={toCatalog(actionsResult.data ?? []) as RbacCatalogOption[]}
      accessAreas={toCatalog(areasResult.data ?? []) as RbacCatalogOption[]}
      dataError={dataError}
      permissions={permissions}
      roles={roles}
      users={users}
    />
  );
}
