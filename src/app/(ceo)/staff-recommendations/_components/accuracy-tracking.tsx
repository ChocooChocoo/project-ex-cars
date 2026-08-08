"use client";
"use no memo";

import { useEffect, useState } from "react";

import { BarChart3, Target, ThumbsDown, ThumbsUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import { getAccuracyData } from "../actions";

interface AccuracyData {
  totalRuns: number;
  helpful: number;
  notHelpful: number;
  accuracy: number;
  topRecommended: { make: string; model: string; year: number }[];
}

export function AccuracyTracking() {
  const [data, setData] = useState<AccuracyData | null>(null);

  useEffect(() => {
    getAccuracyData().then((res) => {
      if (res.success && "totalRuns" in res) setData(res as unknown as AccuracyData);
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

  const totalFeedback = data.helpful + data.notHelpful;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Target className="size-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Accuracy Tracking</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <BarChart3 className="size-5 text-muted-foreground" />
            <span className="text-2xl font-bold">{data.totalRuns}</span>
            <span className="text-muted-foreground text-xs">Total Runs</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <Target className="size-5 text-green-500" />
            <span className="text-2xl font-bold">{data.accuracy}%</span>
            <span className="text-muted-foreground text-xs">Accuracy</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <ThumbsUp className="size-5 text-green-500" />
            <span className="text-2xl font-bold">{data.helpful}</span>
            <span className="text-muted-foreground text-xs">Helpful</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <ThumbsDown className="size-5 text-red-500" />
            <span className="text-2xl font-bold">{data.notHelpful}</span>
            <span className="text-muted-foreground text-xs">Not Helpful</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recommendation Accuracy</CardTitle>
          <CardDescription>
            {totalFeedback > 0
              ? `${data.helpful} out of ${totalFeedback} interactions marked helpful (${data.accuracy}%)`
              : "No feedback received yet. Accuracy data will populate as customers rate recommendations."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span>Helpfulness Rate</span>
                <span className="font-semibold">{data.accuracy}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${data.accuracy}%` }} />
              </div>
            </div>
          </div>

          {data.topRecommended.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-muted-foreground text-xs font-medium">Most Frequently Recommended Vehicles</p>
              <div className="flex flex-wrap gap-2">
                {data.topRecommended.map((v) => (
                  <Badge key={`${v.make}-${v.model}-${v.year}`} variant="secondary" className="text-xs">
                    {v.make} {v.model} ({v.year})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
