"use client";

import { format } from "date-fns";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import { GCE_ROLE_LABELS, mapAccountState, type UserRow } from "./_components/data";
import { Users } from "./_components/users";

const USER_ADMIN_ROLES: GceRole[] = ["ceo", "account_manager", "super_admin"];

interface AccountRow {
  id: string;
  email: string;
  fullName: string | null;
  accountState: string;
  role: string;
  createdAt: string | null;
}

export default function Page() {
  const allowed = useRequireRole(USER_ADMIN_ROLES);
  // Phase 7: Laravel lists every account with its email, state and active role (was auth.admin.listUsers).
  const page = usePageData(allowed ? "admin-users" : "admin-users:denied", () =>
    allowed ? browserApi<{ users: AccountRow[] }>("GET", "/api/v1/admin/users") : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;

  const users: UserRow[] = page.data.users.map((account) => ({
    email: account.email,
    joinedDate: account.createdAt ? format(new Date(account.createdAt), "dd MMM yyyy, h:mm a") : "",
    lastActive: 0,
    name: account.fullName ?? "Unknown user",
    role: GCE_ROLE_LABELS[account.role] ?? account.role,
    status: mapAccountState(account.accountState),
    team: "GCE",
    workspace: ["GCE"],
  }));

  return <Users users={users} />;
}
