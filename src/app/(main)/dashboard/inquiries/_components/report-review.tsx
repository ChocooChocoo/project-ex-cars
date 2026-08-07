"use client";
"use no memo";

import { toast } from "sonner";

import { reviewReport } from "@/app/(main)/inquiries/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function ReportReview({ reports }: { readonly reports: Record<string, unknown>[] }) {
  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">No reports to review.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {reports.map((r) => {
        const reporter = r.reporter as Record<string, unknown> | undefined;
        const inquiry = r.inquiry as Record<string, unknown> | undefined;
        const vehicles = inquiry?.vehicles as Record<string, unknown> | undefined;

        return (
          <Card key={r.id as string}>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  Report #{(r.id as string).slice(0, 8)}
                  <Badge variant={r.state === "open" ? "default" : "secondary"}>{r.state as string}</Badge>
                </CardTitle>
                <p className="mt-1 text-muted-foreground text-xs">
                  By {reporter?.email as string} · {new Date(r.created_at as string).toLocaleString()}
                  {vehicles && ` · ${vehicles.make} ${vehicles.model}`}
                </p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div>
                <span className="font-medium text-sm">Reason</span>
                <p className="text-muted-foreground text-sm">{r.reason as string}</p>
              </div>
              {r.state === "open" && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const result = await reviewReport(r.id as string, "dismiss");
                        if (result.error) toast.error(result.error);
                        else toast.success("Dismissed.");
                      }}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const result = await reviewReport(r.id as string, "uphold");
                        if (result.error) toast.error(result.error);
                        else toast.success("Upheld.");
                      }}
                    >
                      Uphold
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
