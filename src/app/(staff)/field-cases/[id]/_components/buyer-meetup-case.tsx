import Link from "next/link";

import { format } from "date-fns";

import { MeetupMap } from "@/components/maps/lazy-maps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PapersStatus } from "@/lib/transactions/buy-flow";

import { ContractCard } from "./contract-card";
import { type PaperDocumentRow, PapersCard } from "./papers-card";
import { ReceiveCaseButton } from "./receive-case-button";

type Row = Record<string, unknown>;

// Meet Halfway: who the team meets, where and when, and the papers the Confidential Informant carries.
// BH-2: the contract card is the Confidential Informant's; the Mechanic's view is the vehicle check only.
export function BuyerMeetupCase({
  fieldCase,
  transaction,
  papersStatus,
  handover,
  member,
  canRecordPapers,
  papers,
  canUpload,
  deedHref,
}: {
  readonly fieldCase: Row;
  readonly transaction: Row;
  readonly papersStatus: PapersStatus | null;
  readonly handover: Row;
  readonly member: "informant" | null;
  readonly canRecordPapers: boolean;
  readonly papers: PaperDocumentRow[];
  readonly canUpload: boolean;
  readonly deedHref: string;
}) {
  const buyer = transaction.profiles as Row | null;
  const vehicle = transaction.vehicles as Row | null;
  const received = (at: unknown) => (at ? format(new Date(at as string), "MMM d, yyyy h:mm a") : "Not yet");
  const detailsRaw = transaction.purchase_details as Row | Row[] | null;
  const details = (Array.isArray(detailsRaw) ? detailsRaw[0] : detailsRaw) ?? null;
  const meetupPoint =
    details?.meetup_lat != null && details?.meetup_lng != null
      ? { lat: Number(details.meetup_lat), lng: Number(details.meetup_lng) }
      : null;

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
            <p>
              <span className="text-muted-foreground">Received by the Confidential Informant: </span>
              {received(fieldCase.ci_received_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Received by the Mechanic: </span>
              {received(fieldCase.mechanic_received_at)}
            </p>
            {member && !fieldCase.ci_received_at ? <ReceiveCaseButton fieldCaseId={fieldCase.id as string} /> : null}
          </CardContent>
        </Card>
        <PapersCard
          transactionId={transaction.id as string}
          papersStatus={papersStatus}
          canRecord={canRecordPapers}
          documents={papers}
          canUpload={canUpload}
          deedHref={deedHref}
        />
        <ContractCard transactionId={transaction.id as string} details={details} handover={handover} member={member} />
        {/* BH-8: the pin the buyer set, read-only, right here in the app (SH-8: no external map link). */}
        {meetupPoint ? (
          <Card>
            <CardHeader>
              <CardTitle>Meet-up point</CardTitle>
              <CardDescription>Where the buyer set the halfway point. Meet-ups stay inside CALABARZON.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <MeetupMap value={meetupPoint} editable={false} />
              {details?.meetup_address ? <p>{String(details.meetup_address)}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
