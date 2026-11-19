"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import { type RbacCatalogOption, type RbacPermission, type RbacRole, Roles } from "./_components/roles";

const RBAC_ROLES: GceRole[] = ["ceo", "super_admin"];

interface RbacData {
  canManage: boolean;
  users: { id: string; fullName: string; accountState: string; role: string; createdAt: string }[];
  roles: RbacRole[];
  permissions: RbacPermission[];
  accessAreas: RbacCatalogOption[];
  actions: RbacCatalogOption[];
}

export default function Page() {
  const allowed = useRequireRole(RBAC_ROLES);
  // Phase 7: one Laravel read for the whole RBAC catalogue (CEO and Super Admin).
  const page = usePageData(allowed ? "admin-rbac" : "admin-rbac:denied", () =>
    allowed ? browserApi<RbacData>("GET", "/api/v1/admin/rbac") : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const data = page.data;

  return (
    <Roles
      actions={data.actions}
      accessAreas={data.accessAreas}
      dataError={null}
      permissions={data.permissions}
      roles={data.roles}
      users={data.users}
      canManage={data.canManage}
    />
  );
}
