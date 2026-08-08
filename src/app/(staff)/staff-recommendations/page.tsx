import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AccuracyTracking } from "./_components/accuracy-tracking";
import { BuyingPatterns } from "./_components/buying-patterns";
import { MarketInsights } from "./_components/market-insights";
import { PricingTrends } from "./_components/pricing-trends";
import { StockTurnover } from "./_components/stock-turnover";

export default function RecommendationsDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Recommendations & Insights</h1>
          <p className="text-muted-foreground text-sm">
            Pricing trends, stock turnover, buying patterns, market insights, and recommendation accuracy.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pricing" className="flex flex-col gap-4">
        <TabsList className="gap-1">
          <TabsTrigger value="pricing">Pricing Trends</TabsTrigger>
          <TabsTrigger value="turnover">Stock Turnover</TabsTrigger>
          <TabsTrigger value="buying">Buying Patterns</TabsTrigger>
          <TabsTrigger value="market">Market Insights</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing">
          <PricingTrends />
        </TabsContent>

        <TabsContent value="turnover">
          <StockTurnover />
        </TabsContent>

        <TabsContent value="buying">
          <BuyingPatterns />
        </TabsContent>

        <TabsContent value="market">
          <MarketInsights />
        </TabsContent>

        <TabsContent value="accuracy">
          <AccuracyTracking />
        </TabsContent>
      </Tabs>
    </div>
  );
}
