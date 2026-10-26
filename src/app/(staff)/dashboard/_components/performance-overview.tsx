"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import type { MonthPoint } from "../dashboard-summary";

const chartConfig = {
  // Primary for sales (dark in light mode, light in dark mode); new customers is a dashed mid-grey line, so the two
  // series differ by shape as well as shade.
  sales: { label: "Completed sales", color: "var(--primary)" },
  newCustomers: { label: "New customers", color: "var(--chart-2)" },
} satisfies ChartConfig;

// "2026-10" → "Oct 2026" / "Oct"; built from the parts so no time zone can shift the month.
const monthLabel = (month: string, withYear = false) => {
  const [year, m] = month.split("-").map(Number);
  const name = new Date(Date.UTC(year, m - 1, 15)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return withYear ? `${name} ${year}` : name;
};

export function PerformanceOverview({ monthly }: { readonly monthly: MonthPoint[] }) {
  const empty = monthly.every((point) => point.sales === 0 && point.newCustomers === 0);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">Sales and Customers</CardTitle>
        <CardDescription>Completed sales and new customers per month, last 12 months</CardDescription>
      </CardHeader>

      <CardContent>
        {empty ? (
          <p className="py-16 text-center text-muted-foreground text-sm">
            No sales or new customers in the last 12 months.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            <ComposedChart data={monthly} margin={{ top: 0, left: 0 }}>
              <defs>
                <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => monthLabel(value)}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    className="w-48"
                    indicator="line"
                    labelFormatter={(value) => monthLabel(String(value), true)}
                  />
                }
              />
              <ChartLegend verticalAlign="top" content={<ChartLegendContent className="mb-5 justify-end" />} />
              <Area
                dataKey="sales"
                type="monotone"
                fill="url(#fillSales)"
                stroke="var(--color-sales)"
                strokeWidth={1.5}
                dot={false}
                fillOpacity={1}
              />
              <Line
                dataKey="newCustomers"
                type="monotone"
                stroke="var(--color-newCustomers)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
