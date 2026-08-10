import { ArrowDownRight, ArrowUpRight, Ellipsis } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type TransactionsKpiDatum = {
  label: string;
  value: string;
  trendValue: string;
  trendDirection: "up" | "down";
  previousValue: string;
  periodLabel: string;
};

export function TransactionsKpiStrip({ data }: { readonly data: TransactionsKpiDatum[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-6">
        {data.map((d) => (
          <Card key={d.label}>
            <CardHeader>
              <CardTitle className="font-normal text-sm">{d.label}</CardTitle>
              <CardAction>
                <Ellipsis className="size-4" />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-2xl leading-none tracking-tight">{d.value}</div>
                {d.trendDirection === "up" ? (
                  <Badge className="bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300">
                    <ArrowUpRight />
                    {d.trendValue}
                  </Badge>
                ) : (
                  <Badge className="bg-destructive/10 text-destructive">
                    <ArrowDownRight />
                    {d.trendValue}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <span>
                  from <span className="text-foreground">{d.previousValue}</span>
                </span>
                <span>•</span>
                <span>{d.periodLabel}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
