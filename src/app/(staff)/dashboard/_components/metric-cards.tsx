import type { LucideIcon } from "lucide-react";
import { Car, PhilippinePeso, ShoppingCart, TrendingDown, TrendingUp, UserPlus, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import type { DashboardSummary } from "../dashboard-summary";

type Metric = { label: string; value: string; change: number | null; caption: string; icon: LucideIcon };

function ChangeBadge({ change }: { readonly change: number | null }) {
  if (change === null) return null;
  const down = change < 0;
  const Icon = down ? TrendingDown : TrendingUp;
  return (
    <Badge variant={down ? "destructive" : "default"}>
      <Icon className="size-3" aria-hidden="true" />
      {change > 0 ? "+" : ""}
      {change}%
    </Badge>
  );
}

const count = (n: number) => n.toLocaleString("en-PH");

export function MetricCards({ summary }: { readonly summary: DashboardSummary }) {
  const metrics: Metric[] = [
    summary.revenueThisMonth === null
      ? {
          label: "Available Vehicles",
          value: count(summary.availableVehicles),
          change: null,
          caption: "Listed and ready to sell",
          icon: Car,
        }
      : {
          label: "Payments Received This Month",
          value: formatCurrency(summary.revenueThisMonth, { noDecimals: true }),
          change: summary.revenueChange,
          caption: `Verified customer payments. Last month ${formatCurrency(summary.revenueLastMonth ?? 0, { noDecimals: true })}`,
          icon: PhilippinePeso,
        },
    {
      label: "Completed Sales This Month",
      value: count(summary.salesThisMonth),
      change: summary.salesChange,
      caption: `Last month ${count(summary.salesLastMonth)}`,
      icon: ShoppingCart,
    },
    {
      label: "New Customers",
      value: count(summary.newCustomers),
      change: summary.newCustomersChange,
      caption: `First transaction in the last 30 days. Previous 30 days ${count(summary.newCustomersPrevious)}`,
      icon: UserPlus,
    },
    {
      label: "Active Customers",
      value: count(summary.activeCustomers),
      change: null,
      caption: "With a transaction still in progress",
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardHeader>
            <CardTitle>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <metric.icon className="size-4" aria-hidden="true" />
              </div>
            </CardTitle>
            <CardDescription>{metric.label}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{metric.value}</div>
              <ChangeBadge change={metric.change} />
            </div>
            <p className="text-muted-foreground text-sm">{metric.caption}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
