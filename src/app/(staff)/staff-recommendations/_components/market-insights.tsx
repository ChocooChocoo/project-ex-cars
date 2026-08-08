"use client";
"use no memo";

import { useEffect, useState } from "react";

import { Car, DollarSign, Heart, MessageSquare, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

import { getMarketInsights } from "../actions";

interface InsightsData {
  totalVehicles: number;
  availableVehicles: number;
  totalInquiries: number;
  totalFavourites: number;
  avgPrice: number;
  recentListingInquiries: number;
}

export function MarketInsights() {
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    getMarketInsights()
      .then((res) => {
        if (res.success && "totalVehicles" in res) setData(res as unknown as InsightsData);
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

  const sellThroughRate =
    data.totalVehicles > 0 ? Math.round(((data.totalInquiries + data.totalFavourites) / data.totalVehicles) * 100) : 0;

  const insights = [
    {
      title: "Total Inventory",
      value: data.totalVehicles.toLocaleString(),
      subtitle: `${data.availableVehicles.toLocaleString()} available`,
      icon: Car,
    },
    {
      title: "Average Price",
      value: formatCurrency(data.avgPrice),
      subtitle: "Available vehicles",
      icon: DollarSign,
    },
    {
      title: "Total Inquiries",
      value: data.totalInquiries.toLocaleString(),
      subtitle: "Across all vehicles",
      icon: MessageSquare,
    },
    {
      title: "Favourites Saved",
      value: data.totalFavourites.toLocaleString(),
      subtitle: "Customer interest signals",
      icon: Heart,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5 text-primary" />
        <h2 className="font-semibold text-lg tracking-tight">Market Insights</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {insights.map((insight) => (
          <Card key={insight.title}>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <insight.icon className="size-5 text-muted-foreground" />
              <span className="font-bold text-2xl">{insight.value}</span>
              <span className="text-muted-foreground text-xs">{insight.title}</span>
              <span className="text-[10px] text-muted-foreground">{insight.subtitle}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Engagement Rate</CardTitle>
          <CardDescription>Inquiries and favourites relative to total vehicles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span>Sell-through interest</span>
                <span className="font-semibold">{sellThroughRate}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(sellThroughRate, 100)}%` }}
                />
              </div>
            </div>
            <div className="text-muted-foreground text-xs">
              {data.recentListingInquiries} inquiries on recent listings
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
