import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import type { DashboardSummary, Forecast } from "../dashboard-summary";

const monthName = (month: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

function Estimate({
  label,
  forecast,
  format,
}: {
  readonly label: string;
  readonly forecast: Forecast;
  readonly format: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-medium text-3xl tabular-nums leading-none tracking-tight">{format(forecast.expected)}</p>
      <p className="text-muted-foreground text-sm tabular-nums">
        Likely between {format(forecast.low)} and {format(forecast.high)}
      </p>
    </div>
  );
}

// T06 DSS: the CEO's view of next month, projected from the trend of the last completed months.
export function NextMonthForecast({ forecast }: { readonly forecast: DashboardSummary["forecast"] }) {
  const units = (n: number) => Math.round(n).toLocaleString("en-PH");
  const pesos = (n: number) => formatCurrency(Math.round(n), { noDecimals: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
          Forecast for {monthName(forecast.month)}
        </CardTitle>
        <CardDescription>
          Decision support: the trend of the last {forecast.basisMonths} completed months, carried forward. Use it as a
          guide for stock and cash planning, not a guarantee.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <Estimate label="Expected completed sales" forecast={forecast.sales} format={units} />
        {forecast.revenue ? (
          <Estimate label="Expected income (payments received)" forecast={forecast.revenue} format={pesos} />
        ) : null}
      </CardContent>
    </Card>
  );
}
