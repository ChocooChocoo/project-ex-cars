"use client";
"use no memo";

import { useEffect, useState } from "react";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";

import { getPricingTrends } from "../actions";

export function PricingTrends() {
  const [data, setData] = useState<{
    byMake: { make: string; avgPrice: number }[];
    timeline: { month: string; avgPrice: number }[];
  } | null>(null);

  useEffect(() => {
    getPricingTrends().then((res) => {
      if (res.success && "byMake" in res) setData(res as unknown as typeof data);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Pricing Trends</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Average Price by Make</CardTitle>
            <CardDescription>Mean listing price per vehicle manufacturer</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-64 w-full">
              <BarChart data={data.byMake.slice(0, 10)} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="make" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip />
                <Bar dataKey="avgPrice" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Price Trend Over Time</CardTitle>
            <CardDescription>Average listing price per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-64 w-full">
              <LineChart data={data.timeline} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip />
                <Line type="monotone" dataKey="avgPrice" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
