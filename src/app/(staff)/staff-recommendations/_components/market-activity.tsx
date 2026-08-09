"use client";

import { useEffect, useState } from "react";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { getMarketActivity, type MarketActivityPoint } from "../actions";

const DAY_MS = 24 * 60 * 60 * 1000;

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
});

const formatWeekday = (value: number) => weekdayFormatter.format(new Date(value));

const formatCount = (value: number | string) => Number(value).toLocaleString("en-US");

const chartConfig = {
  inquiries: {
    color: "var(--chart-4)",
    label: "Inquiries",
  },
  sales: {
    color: "var(--chart-2)",
    label: "Sales",
  },
} satisfies ChartConfig;

interface MarketActivityData {
  points: MarketActivityPoint[];
  weekStart: number;
  weekEnd: number;
}

export function MarketActivity() {
  const [data, setData] = useState<MarketActivityData | null>(null);

  useEffect(() => {
    getMarketActivity()
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

  const weekdayTicks = Array.from({ length: 7 }, (_, index) => data.weekStart + (index + 0.5) * DAY_MS);
  const chartDomain = [data.weekStart, data.weekEnd];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Market Activity</CardTitle>
        <CardAction>
          <Select defaultValue="weekly">
            <SelectTrigger className="w-28" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-50 w-full">
          <LineChart accessibilityLayer data={data.points} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="timestamp"
              domain={chartDomain}
              scale="time"
              tickFormatter={formatWeekday}
              tickLine={false}
              tickMargin={10}
              ticks={weekdayTicks}
              tick={{ fontSize: 12 }}
              type="number"
            />
            <YAxis hide axisLine={false} tickLine={false} tickMargin={10} tick={{ fontSize: 12 }} />
            <ChartTooltip
              cursor={false}
              content={({ active, payload, label }) => (
                <ChartTooltipContent
                  active={active}
                  hideLabel
                  label={label}
                  payload={payload?.map((item) => ({
                    ...item,
                    value: typeof item.value === "number" ? formatCount(item.value) : item.value,
                  }))}
                />
              )}
            />
            <Line
              connectNulls
              dataKey="sales"
              dot={false}
              stroke="var(--color-sales)"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeWidth={1}
              type="linear"
            />
            <Line
              dataKey="inquiries"
              dot={false}
              stroke="var(--color-inquiries)"
              strokeLinecap="round"
              strokeWidth={3}
              type="linear"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
