"use client";

import { useEffect, useState } from "react";

import { ArrowDownRight, ArrowUpRight, Ellipsis } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import { getRecommendationKpis, type KpiStat } from "../actions";

export function KpiStrip() {
  const [cards, setCards] = useState<KpiStat[] | null>(null);

  useEffect(() => {
    getRecommendationKpis()
      .then((res) => {
        if (res.success) setCards(res.data);
      })
      .catch(console.error);
  }, []);

  if (!cards) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-5" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
        {cards.map((kpi) => {
          const isUp = kpi.direction === "up";
          const TrendIcon = isUp ? ArrowUpRight : ArrowDownRight;

          return (
            <Card key={kpi.label}>
              <CardHeader>
                <CardTitle className="font-normal text-sm">{kpi.label}</CardTitle>
                <CardAction>
                  <Ellipsis className="size-4" />
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-2xl leading-none tracking-tight">{kpi.value}</div>
                  <Badge
                    className={
                      isUp
                        ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                        : "bg-destructive/10 text-destructive"
                    }
                  >
                    <TrendIcon />
                    {Math.abs(kpi.change)}%
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <span>
                    from <span className="text-foreground">{kpi.previous}</span>
                  </span>
                  <span>•</span>
                  <span>{kpi.period}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
