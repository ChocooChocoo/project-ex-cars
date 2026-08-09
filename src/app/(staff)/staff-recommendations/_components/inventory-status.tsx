"use client";

import { useEffect, useState } from "react";

import { ArrowUpRight, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import { Label, Pie, PieChart } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

import { getInventoryStatus } from "../actions";

interface InventoryStatusData {
  available: number;
  reserved: number;
  sold: number;
}

const gaugeSegmentCount = 32;

const chartConfig = {
  available: {
    label: "Available",
    color: "var(--chart-2)",
  },
  reserved: {
    label: "Reserved",
    color: "var(--chart-1)",
  },
  sold: {
    label: "Sold",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

export function InventoryStatus() {
  const [data, setData] = useState<InventoryStatusData | null>(null);

  useEffect(() => {
    getInventoryStatus()
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-5" />
        </CardContent>
      </Card>
    );
  }

  const totalUnits = data.available + data.reserved + data.sold;
  const availablePercent = totalUnits > 0 ? Math.round((data.available / totalUnits) * 100) : 0;
  const availableSegments = totalUnits > 0 ? Math.round((data.available / totalUnits) * gaugeSegmentCount) : 0;
  const reservedSegments = totalUnits > 0 ? Math.round((data.reserved / totalUnits) * gaugeSegmentCount) : 0;
  const gaugeSegments = Array.from({ length: gaugeSegmentCount }, (_, index) => {
    const status =
      index < availableSegments ? "available" : index < availableSegments + reservedSegments ? "reserved" : "sold";

    return {
      fill: `var(--color-${status})`,
      id: `segment-${index + 1}`,
      status,
      value: 1,
    };
  });
  const inventorySummary = [
    {
      icon: PackageCheck,
      label: "Available",
      value: data.available,
    },
    {
      icon: TriangleAlert,
      label: "Reserved",
      value: data.reserved,
    },
    {
      icon: PackageX,
      label: "Sold",
      value: data.sold,
    },
  ] as const;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Inventory</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {availablePercent}% available
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={chartConfig} className="mx-auto h-30 w-full">
          <PieChart>
            <Pie
              cx="50%"
              cy="100%"
              cornerRadius={6}
              data={gaugeSegments}
              dataKey="value"
              endAngle={0}
              innerRadius={80}
              outerRadius={110}
              paddingAngle={2}
              startAngle={180}
              stroke="var(--card)"
              strokeWidth={1}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                        <tspan
                          className="fill-foreground font-medium text-2xl tabular-nums"
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                        >
                          {availablePercent}%
                        </tspan>
                        <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy || 0) + 38}>
                          Available
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <Separator />

        <div className="grid grid-cols-3 divide-x">
          {inventorySummary.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-3 text-center">
              <div className="grid size-9 place-items-center rounded-full bg-muted">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-muted-foreground text-xs leading-none">{item.label}</div>
                <div className="font-medium text-sm tabular-nums">{item.value.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
