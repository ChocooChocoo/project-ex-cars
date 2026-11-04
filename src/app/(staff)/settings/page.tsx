import { requireRole } from "@/lib/auth/guards";
import { SETTINGS_MANAGER_ROLES } from "@/lib/auth/roles";
import { getFinancingMarkupPct } from "@/lib/settings/financing";

import { FinancingMarkupForm } from "./_components/financing-markup-form";

export default async function SettingsPage() {
  await requireRole(SETTINGS_MANAGER_ROLES);
  const markupPct = await getFinancingMarkupPct();

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-3xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Business rules that apply across the GCE system.</p>
      </div>
      <FinancingMarkupForm initialPct={markupPct} />
    </div>
  );
}
