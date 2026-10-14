"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import { createMeetupFieldCase } from "@/app/(staff)/transactions/delivery-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { PersonSelect } from "./delivery-panel";

type Row = Record<string, unknown>;
type Person = { id: string; full_name: string | null };

export interface MeetupPick {
  readonly informant_id?: string;
  readonly mechanic_id?: string;
}

// Meet Halfway: the Confidential Informant and the Mechanic who meet the buyer.
// A cash request names them with the approval ("approval": the picks ride along with Approve). A financed
// one names them after the contract is approved and the buyer books ("assign": its own button).
export function MeetupTeamPanel({
  transactionId,
  mode,
  informants,
  mechanics,
  pick,
  onPick,
  fieldCase,
  waitingFor,
}: {
  readonly transactionId: string;
  readonly mode: "approval" | "assign" | "assigned";
  readonly informants: Person[];
  readonly mechanics: Person[];
  readonly pick: MeetupPick;
  readonly onPick: (pick: MeetupPick) => void;
  readonly fieldCase: Row | null;
  readonly waitingFor: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const complete = Boolean(pick.informant_id && pick.mechanic_id);
  const received = (at: unknown) => (at ? `received ${format(new Date(at as string), "MMM d, h:mm a")}` : "not yet");

  async function assign() {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    fd.set("informant_id", pick.informant_id ?? "");
    fd.set("mechanic_id", pick.mechanic_id ?? "");
    setBusy(true);
    const result = await createMeetupFieldCase(fd);
    setBusy(false);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Confidential Informant notified.");
      router.refresh();
    }
  }

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Meet-up team</CardTitle>
        <CardDescription>
          {mode === "approval"
            ? "Choose who meets the buyer. Approving creates their field case and sends them the command."
            : "A Confidential Informant and a Mechanic meet the buyer. The Confidential Informant carries the papers."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {mode === "assigned" && fieldCase ? (
          <>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Confidential Informant</dt>
                <dd>Field case {received(fieldCase.ci_received_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Mechanic</dt>
                <dd>Field case {received(fieldCase.mechanic_received_at)}</dd>
              </div>
            </dl>
            <Button asChild size="sm" variant="outline" className="self-start">
              <Link href={`/dashboard/field-cases/${fieldCase.id}`}>Open field case</Link>
            </Button>
          </>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <PersonSelect
                label="Confidential Informant"
                people={informants}
                value={pick.informant_id}
                onChange={(informant_id) => onPick({ ...pick, informant_id })}
              />
              <PersonSelect
                label="Mechanic"
                people={mechanics}
                value={pick.mechanic_id}
                onChange={(mechanic_id) => onPick({ ...pick, mechanic_id })}
              />
            </div>
            {mode === "approval" ? (
              <p className="text-muted-foreground text-xs">
                {complete
                  ? "Team chosen. Approve the request to send the command."
                  : "The request cannot be approved until both are chosen."}
              </p>
            ) : (
              <>
                {waitingFor ? <p className="text-muted-foreground text-xs">{waitingFor}</p> : null}
                <Button
                  size="sm"
                  className="self-start"
                  disabled={busy || !complete || Boolean(waitingFor)}
                  onClick={assign}
                >
                  Assign team and send the command
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
