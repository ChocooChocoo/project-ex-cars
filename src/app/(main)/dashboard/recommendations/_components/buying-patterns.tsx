"use client";
"use no memo";

import { useEffect, useState } from "react";

import { ShoppingCart } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";

import { getBuyingPatterns } from "../actions";

interface PatternsData {
  topMakes: { name: string; count: number }[];
  bodyTypes: { type: string; count: number }[];
  fuelTypes: { type: string; count: number }[];
  priceRanges: { range: string; count: number }[];
}

export function BuyingPatterns() {
  const [data, setData] = useState<PatternsData | null>(null);

  useEffect(() => {
    getBuyingPatterns().then((res) => {
      if (res.success && "topMakes" in res) setData(res as unknown as PatternsData);
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
        <ShoppingCart className="size-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Buying Patterns</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Makes in Inventory</CardTitle>
            <CardDescription>Most listed vehicle brands</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-60 w-full">
              <BarChart data={data.topMakes} layout="vertical" margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <ChartTooltip />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Price Range Distribution</CardTitle>
            <CardDescription>Vehicles across price brackets</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="mx-auto h-60 w-full">
              <PieChart>
                <Pie
                  data={data.priceRanges.filter((p) => p.count > 0)}
                  dataKey="count"
                  nameKey="range"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="var(--color-primary)"
                  label={({ count }) => `${count}`}
                >
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      const total = data.priceRanges.reduce((s, p) => s + p.count, 0);
                      return (
                        <text
                          x={(viewBox as { cx: number }).cx}
                          y={(viewBox as { cy: number }).cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={(viewBox as { cx: number }).cx}
                            dy="-0.5em"
                            className="fill-foreground text-lg font-bold"
                          >
                            {total}
                          </tspan>
                          <tspan
                            x={(viewBox as { cx: number }).cx}
                            dy="1.5em"
                            className="fill-muted-foreground text-xs"
                          >
                            Total
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Body Type Distribution</CardTitle>
            <CardDescription>Vehicles by body style</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-52 w-full">
              <BarChart
                data={data.bodyTypes.filter((b) => b.count > 0).slice(0, 8)}
                margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip />
                <Bar dataKey="count" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fuel Type Distribution</CardTitle>
            <CardDescription>Vehicles by fuel</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-52 w-full">
              <BarChart
                data={data.fuelTypes.filter((f) => f.count > 0)}
                margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip />
                <Bar dataKey="count" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
