"use client";

import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

import type { PerformanceHighlightData } from "./roadmap-dashboard-data";

const chartConfig = {
  duration: {
    label: "Score",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

type ChartPayload = PerformanceHighlightData;

function PerformanceHighlightBar({
  height = 0,
  payload,
  width = 0,
  x = 0,
  y = 0,
}: {
  height?: number;
  payload?: ChartPayload;
  width?: number;
  x?: number;
  y?: number;
}) {
  if (!payload) {
    return null;
  }

  const barHeight = Math.min(32, height);
  const barY = y + (height - barHeight) / 2;
  const radius = barHeight / 2;
  const fillWidth = Math.max(width * (payload.score / 100), 86);
  const avatarSize = 22;
  const avatarStart = x + 8;
  const avatarY = barY + (barHeight - avatarSize) / 2 - 1.5;
  const labelX = avatarStart + payload.initials.length * 14 + 14;

  return (
    <g>
      <rect
        fill="color-mix(in oklch, var(--color-duration) 18%, transparent)"
        height={barHeight}
        rx={radius}
        width={width}
        x={x}
        y={barY}
      />
      <rect fill="var(--color-duration)" height={barHeight} rx={radius} width={fillWidth} x={x} y={barY} />

      {payload.initials.map((initials, index) => {
        const avatarX = avatarStart + index * 14;

        return (
          <foreignObject height={avatarSize + 4} key={initials} width={avatarSize + 4} x={avatarX - 2} y={avatarY}>
            <Avatar className="size-5 bg-muted" size="sm">
              <AvatarFallback className="text-foreground">{initials}</AvatarFallback>
            </Avatar>
          </foreignObject>
        );
      })}

      <text
        dominantBaseline="middle"
        x={labelX}
        y={barY + barHeight / 2 + 0.5}
        className="fill-primary-foreground font-medium text-xs"
      >
        {payload.subject}
      </text>

      <text
        dominantBaseline="middle"
        fill="var(--foreground)"
        fontSize={11}
        textAnchor="end"
        x={x + width - 10}
        y={barY + barHeight / 2 + 0.5}
        className="font-medium tabular-nums"
      >
        {payload.score}%
      </text>
    </g>
  );
}

interface RoadmapPerformanceHighlightsProps {
  highlights: PerformanceHighlightData[];
}

export function RoadmapPerformanceHighlights({ highlights }: RoadmapPerformanceHighlightsProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Team Progress</CardTitle>
        <CardAction className="flex items-center gap-1 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            View Details <ArrowRight className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-70 w-full">
          <BarChart
            accessibilityLayer
            data={highlights}
            layout="vertical"
            margin={{ bottom: 0, left: 0, right: 8, top: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="4 4" />
            <XAxis
              axisLine={false}
              domain={[0, 4]}
              tickFormatter={(value) => ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"][Number(value)] ?? ""}
              tickLine={false}
              tickMargin={10}
              ticks={[0, 1, 2, 3, 4]}
              type="number"
            />
            <YAxis axisLine={false} dataKey="team" tickLine={false} tickMargin={10} type="category" width={80} />
            <Bar dataKey="start" fill="transparent" stackId="timeline" />
            <Bar dataKey="duration" shape={<PerformanceHighlightBar />} stackId="timeline" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
