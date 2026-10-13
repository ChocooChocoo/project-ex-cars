import Link from "next/link";

import { format } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PapersStatus } from "@/lib/transactions/buy-flow";

import { PapersCard } from "./papers-card";

type Row = Record<string, unknown>;

// Meet Halfway: who the team meets, where and when, and the papers the Confidential Informant carries.
export function BuyerMeetupCase({
  fieldCase,
  transaction,
  papersStatus,
  canRecordPapers,
}: {
  readonly fieldCase: Row;
  readonly transaction: Row;
  readonly papersStatus: PapersStatus | null;
  readonly canRecordPapers: boolean;
}) {
  const buyer = transaction.profiles as Row | null;
  const vehicle = transaction.vehicles as Row | null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/field-cases" className="text-muted-foreground text-sm underline">
          Back to field cases
        </Link>
        <h1 className="text-3xl leading-none tracking-tight">Buyer meet-up</h1>
        <p className="text-muted-foreground text-sm">
          {fieldCase.schedule ? format(new Date(fieldCase.schedule as string), "MMM d, yyyy h:mm a") : "No schedule"} ·{" "}
          {String(fieldCase.location ?? "No location")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Meet-up pack</CardTitle>
            <CardDescription>The buyer inspects the car at the agreed place before deciding.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Buyer: </span>
              {String(buyer?.full_name ?? "—")} {buyer?.phone ? `· ${buyer.phone}` : ""}
            </p>
            <p>
              <span className="text-muted-foreground">Vehicle: </span>
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.stock_code})` : "—"}
            </p>
          </CardContent>
        </Card>
        <PapersCard transactionId={transaction.id as string} papersStatus={papersStatus} canRecord={canRecordPapers} />
      </div>
    </div>
  );
}
