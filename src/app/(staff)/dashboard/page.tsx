import { getCurrentRole } from "@/app/auth/actions";
import { checkAndNotifyDueInstallments, getNotifications } from "@/lib/notifications/actions";

import { MetricCards } from "./_components/metric-cards";
import { NotificationsPanel } from "./_components/notifications-panel";
import { PerformanceOverview } from "./_components/performance-overview";
import { Phase6Overview } from "./_components/phase6-overview";
import { ReconditioningOverview } from "./_components/reconditioning-overview";
import { SubscriberOverview } from "./_components/subscriber-overview";

export default async function Page() {
  const role = await getCurrentRole();
  const isCeo = role === "ceo";

  await checkAndNotifyDueInstallments();
  const notifications = role ? await getNotifications(role) : [];

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      {isCeo ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold text-lg tracking-tight">Operations Overview</h2>
            <p className="text-muted-foreground text-sm">
              Live counts from staff, payroll, field, and finance records.
            </p>
          </div>
          <Phase6Overview />
        </section>
      ) : null}
      <MetricCards />
      <PerformanceOverview />
      <ReconditioningOverview />
      <SubscriberOverview />
      <NotificationsPanel notifications={notifications} />
    </div>
  );
}
