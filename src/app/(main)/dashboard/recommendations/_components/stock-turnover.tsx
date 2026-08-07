"use client";
"use no memo";

import { useEffect, useState } from "react";

import { CheckCircle, Clock, type LucideIcon, Package, Truck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";

import { getStockTurnover } from "../actions";

interface StockData {
  total: number;
  available: number;
  sold: number;
  reserved: number;
  byCondition: { condition: string; count: number }[];
}

export function StockTurnover() {
  const [data, setData] = useState<StockData | null>(null);

  useEffect(() => {
    getStockTurnover().then((res) => {
      if (res.success && "total" in res) setData(res as unknown as StockData);
    });
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

  const kpis: { label: string; value: number; icon: LucideIcon }[] = [
    { label: "Total Vehicles", value: data.total, icon: Package },
    { label: "Available", value: data.available, icon: Truck },
    { label: "Sold", value: data.sold, icon: CheckCircle },
    { label: "Reserved", value: data.reserved, icon: Clock },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Package className="size-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Stock Turnover</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <kpi.icon className="size-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{kpi.value}</span>
              <span className="text-muted-foreground text-xs">{kpi.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Inventory by Condition</CardTitle>
          <CardDescription>Vehicle distribution across conditions</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="h-56 w-full">
            <BarChart data={data.byCondition} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="condition" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <ChartTooltip />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="count" position="top" fontSize={11} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
