"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { SETTINGS_MANAGER_ROLES } from "@/lib/auth/roles";

import { FinancingMarkupForm } from "./_components/financing-markup-form";

export default function SettingsPage() {
  const allowed = useRequireRole(SETTINGS_MANAGER_ROLES);
  const page = usePageData(allowed ? "admin-settings" : "admin-settings:denied", () =>
    allowed ? browserApi<{ financingMarkupPct: number }>("GET", "/api/v1/admin/settings") : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-3xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Business rules that apply across the GCE system.</p>
      </div>
      <FinancingMarkupForm initialPct={page.data.financingMarkupPct} />
    </div>
  );
}
