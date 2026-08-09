import { InventoryAllocation } from "./_components/inventory-allocation";
import { InventoryStatus } from "./_components/inventory-status";
import { KpiStrip } from "./_components/kpi-strip";
import { MarketActivity } from "./_components/market-activity";
import { SalesOverview } from "./_components/sales-overview";
import { TopVehicles } from "./_components/top-vehicles";

export default function RecommendationsDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Recommendations & Insights</h1>
          <p className="text-muted-foreground text-sm">
            Inventory, sales, customer demand, and market activity at a glance.
          </p>
        </div>
      </div>

      <KpiStrip />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <SalesOverview />
        </div>
        <div className="xl:col-span-5">
          <MarketActivity />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <InventoryAllocation />
        </div>
        <div className="xl:col-span-6">
          <InventoryStatus />
        </div>
      </div>

      <TopVehicles />
    </div>
  );
}
