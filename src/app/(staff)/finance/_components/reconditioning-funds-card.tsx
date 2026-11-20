import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export type ReconditioningFundRow = {
  id: string;
  amount_cents: number;
  reason: string | null;
  shortfall_reason: string | null;
  created_at: string;
  disbursement_requests?: { status?: string | null } | null;
  reconditioning_jobs?: {
    id: string;
    vehicle_id: string;
    state: string;
    refund_due_cents: number | null;
    refunded_at: string | null;
    vehicles?: { make: string | null; model: string | null; year: number | null } | null;
    parts?: Array<{ part_name: string; replacement_brand: string | null; cost: number; photo_url: string | null }>;
  } | null;
  reconditioning_fund_receipts?: Array<{ storage_path: string; signed_url?: string | null }>;
};

export function ReconditioningFundsCard({ requests }: { readonly requests: ReconditioningFundRow[] }) {
  const visible = requests.filter((request) => request.reconditioning_jobs);
  if (visible.length === 0) return null;

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Reconditioning funds</CardTitle>
        <CardDescription>
          Per-part restoration requests, shortfall top-ups, receipts and leftover refunds for repossessed cars.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {visible.map((request) => {
          const job = request.reconditioning_jobs;
          if (!job) return null;
          const vehicle = job.vehicles;
          const name = vehicle
            ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
            : "Vehicle";
          const status = request.disbursement_requests?.status ?? "submitted";
          return (
            <div key={request.id} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground text-xs">
                    {request.shortfall_reason ?? request.reason ?? "Reconditioning request"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">{formatCurrency(request.amount_cents / 100)}</span>
                  <Badge variant="outline">{status.replace(/_/g, " ")}</Badge>
                  {job.refund_due_cents ? (
                    <Badge variant={job.refunded_at ? "secondary" : "destructive"}>
                      {job.refunded_at ? "Refund returned" : `Refund ${formatCurrency(job.refund_due_cents / 100)}`}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {/* Notes line 193: once the job is done, the parts the Mechanic actually repaired, with photos. */}
              {job.state === "completed" && job.parts?.length ? (
                <section className="flex flex-col gap-1" aria-label="After reconditioning">
                  <h3 className="font-medium text-xs">After reconditioning</h3>
                  <ul className="flex flex-col gap-1 text-xs">
                    {job.parts.map((part) => (
                      <li key={part.part_name} className="flex flex-wrap items-center gap-2">
                        <span>
                          {part.part_name}
                          {part.replacement_brand ? ` (${part.replacement_brand})` : ""}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{formatCurrency(part.cost)}</span>
                        {part.photo_url ? (
                          <a
                            href={part.photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline underline-offset-4"
                          >
                            Photo
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                {request.reconditioning_fund_receipts?.length ? (
                  request.reconditioning_fund_receipts.map((receipt) => (
                    <a
                      key={receipt.storage_path}
                      href={receipt.signed_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-xs underline underline-offset-4"
                    >
                      Receipt
                    </a>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">No receipts</span>
                )}
                <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                  <Link href={`/dashboard/vehicles/${job.vehicle_id}`}>Open vehicle</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
