"use client";

import { useEffect, useMemo, useState } from "react";

import { format, parse } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

import { getSalesOverview, type SalesOverviewPoint } from "../actions";

const salesOverviewConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--foreground)",
  },
  units: {
    label: "Units",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

function formatMonthTick(value: string) {
  const parts = value.split(" ");
  const range = parts.at(-1);
  const month = parts.slice(0, -1).join(" ");

  return range === "11-15" ? month : "";
}

function formatTooltipLabel(value: string) {
  const parts = value.split(" ");
  const range = parts.at(-1);
  const month = parse(parts.slice(0, -1).join(" "), "MMM yy", new Date());
  const [start, end] = String(range).split("-");
  const lastDayOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startDate = new Date(month.getFullYear(), month.getMonth(), Number(start));
  const endDate = new Date(month.getFullYear(), month.getMonth(), Math.min(Number(end), lastDayOfMonth));

  return `${format(month, "MMM")} ${format(startDate, "do")} - ${format(endDate, "do")}, ${format(month, "yyyy")}`;
}

function formatCurrencyTooltipValue(value: unknown) {
  return typeof value === "number" ? formatCurrency(value, { currency: "PHP", noDecimals: true }) : String(value ?? "");
}

export function SalesOverview() {
  const [points, setPoints] = useState<SalesOverviewPoint[] | null>(null);

  useEffect(() => {
    getSalesOverview()
      .then((res) => {
        if (res.success) setPoints(res.data);
      })
      .catch(console.error);
  }, []);

  const domains = useMemo(() => {
    const revenueMax = Math.max(...(points ?? []).map((point) => point.revenue), 0);
    const unitsMax = Math.max(...(points ?? []).map((point) => point.units), 0);
    return {
      revenue: [0, Math.ceil(revenueMax * 1.15) || 1],
      units: [0, Math.ceil(unitsMax * 1.15) || 1],
    };
  }, [points]);

  if (!points) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-5" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Sales Overview</CardTitle>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={salesOverviewConfig} className="h-74 w-full">
          <ComposedChart accessibilityLayer data={points} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
            <defs>
              <filter id="sales-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="var(--color-revenue)" floodOpacity="0.35" />
                <feComposite in2="blur" operator="in" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid yAxisId="units" vertical={false} />
            <XAxis
              dataKey="period"
              axisLine={false}
              height={30}
              interval={0}
              minTickGap={0}
              tick={{ fontSize: 10 }}
              tickLine={false}
              tickMargin={8}
              tickFormatter={(value) => formatMonthTick(String(value))}
            />
            <YAxis yAxisId="revenue" hide domain={domains.revenue} />
            <YAxis yAxisId="units" hide domain={domains.units} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-40"
                  labelFormatter={(value) => formatTooltipLabel(String(value))}
                  formatter={(value, name, item) => (
                    <>
                      <div
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor: item.color,
                        }}
                      />
                      <div className="flex flex-1 items-center justify-between leading-none">
                        <span className="text-muted-foreground">{String(name ?? "")}</span>
                        <span className="font-medium font-mono text-foreground tabular-nums">
                          {formatCurrencyTooltipValue(value)}
                        </span>
                      </div>
                    </>
                  )}
                />
              }
              cursor={{
                stroke: "var(--border)",
                strokeDasharray: "4 4",
              }}
            />
            <Bar
              yAxisId="units"
              barSize={4}
              dataKey="units"
              fill="var(--color-units)"
              name="Units"
              opacity={0.18}
              radius={[6, 6, 0, 0]}
            />
            <Area
              yAxisId="revenue"
              dataKey="revenue"
              fill="none"
              filter="url(#sales-line-glow)"
              name="Revenue"
              stroke="var(--color-revenue)"
              strokeWidth={1.8}
              type="linear"
              activeDot={{
                r: 4,
                fill: "var(--background)",
                stroke: "var(--color-revenue)",
                strokeWidth: 2,
              }}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
