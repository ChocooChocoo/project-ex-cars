import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  Car,
  FileCheck2,
  Megaphone,
  PhilippinePeso,
  ShoppingCart,
  Stamp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface OperationsCounts {
  attendanceToday: number;
  pendingRequests: number;
  pendingRuns: number;
  openCases: number;
  activeDisbursements: number;
  publishedAnnouncements: number;
  availableInventory: number;
  pendingApprovals: number;
  soldVehicles: number;
  verifiedRevenueCents: number;
}

export function Phase6Overview({ counts }: { readonly counts: OperationsCounts }) {
  const {
    attendanceToday,
    pendingRequests,
    pendingRuns,
    openCases,
    activeDisbursements,
    publishedAnnouncements,
    availableInventory,
    pendingApprovals,
    soldVehicles,
  } = counts;
  const totalRevenueCents = counts.verifiedRevenueCents;

  const metrics = [
    {
      label: "Completed Sales",
      value: soldVehicles,
      icon: ShoppingCart,
      href: "/dashboard/transactions?state=completed",
    },
    {
      label: "Revenue (Verified)",
      value: `₱${Math.round(totalRevenueCents / 100).toLocaleString()}`,
      icon: PhilippinePeso,
      href: "/dashboard/finance",
    },
    {
      label: "Available Inventory",
      value: availableInventory,
      icon: Car,
      href: "/dashboard/vehicles",
    },
    {
      label: "Pending Report Approvals",
      value: pendingApprovals,
      icon: Stamp,
      href: "/dashboard/reports",
    },
    {
      label: "Attendance Today",
      value: attendanceToday,
      icon: CalendarClock,
      href: "/dashboard/attendance",
    },
    {
      label: "Pending Requests",
      value: pendingRequests,
      icon: Users,
      href: "/dashboard/employee-requests",
    },
    {
      label: "Active Payroll Runs",
      value: pendingRuns,
      icon: BriefcaseBusiness,
      href: "/dashboard/payroll",
    },
    {
      label: "Open Field Cases",
      value: openCases,
      icon: FileCheck2,
      href: "/dashboard/field-cases",
    },
    {
      label: "Active Disbursements",
      value: activeDisbursements,
      icon: Banknote,
      href: "/dashboard/finance",
    },
    {
      label: "Published Announcements",
      value: publishedAnnouncements,
      icon: Megaphone,
      href: "/dashboard/announcements",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-3 dark:*:data-[slot=card]:bg-card">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
              </CardTitle>
              <CardDescription>{metric.label}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{metric.value}</div>
                <Badge variant="secondary" className="rounded-md">
                  <a href={metric.href} className="hover:underline">
                    View →
                  </a>
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">Live from platform records</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
