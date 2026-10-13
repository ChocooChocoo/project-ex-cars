"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { receivePapers, requestPapersRelease } from "@/app/(staff)/transactions/handover-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PAPERS_STATUS_LABELS, type PapersStatus } from "@/lib/transactions/buy-flow";

type Result = { error: string } | { success: true };

// Papers release: the car is marked sold only after its papers leave the Confidential Informant.
// GCE visit: the Sales Manager requests and receives them here. Meet-up or delivery: the assigned
// Confidential Informant records them on the field case, so this panel only reports.
export function HandoverPanel({
  transactionId,
  papersStatus,
  fieldArrangement,
  open,
  userRole,
}: {
  readonly transactionId: string;
  readonly papersStatus: PapersStatus | null;
  readonly fieldArrangement: boolean;
  readonly open: boolean;
  readonly userRole: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const canAct = open && !fieldArrangement && ["sales_manager", "ceo"].includes(userRole);
  const inStore = !papersStatus || papersStatus === "returned";

  async function send(action: (fd: FormData) => Promise<Result>, message: string) {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    setBusy(true);
    const result = await action(fd);
    setBusy(false);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(message);
      router.refresh();
    }
  }

  const waiting = fieldArrangement
    ? papersStatus === "handed_over"
      ? "The buyer has the papers."
      : "The assigned Confidential Informant records the papers on the field case."
    : papersStatus === "requested"
      ? "Waiting for the Confidential Informant to approve and hand the papers over."
      : papersStatus === "received"
        ? "The papers are with the Sales Manager. The car can be marked sold."
        : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle papers</CardTitle>
        <CardDescription>
          OR/CR, Deed of Sale and related documents. The car is marked sold only after the Confidential Informant
          releases them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={inStore ? "outline" : "secondary"}>
            {papersStatus ? PAPERS_STATUS_LABELS[papersStatus] : "With the Confidential Informant"}
          </Badge>
        </p>
        {waiting ? <p className="text-muted-foreground">{waiting}</p> : null}
        {canAct && inStore ? (
          <Button
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() => send(requestPapersRelease, "Papers requested from the Confidential Informant.")}
          >
            Request papers release
          </Button>
        ) : null}
        {canAct && papersStatus === "handed_over" ? (
          <Button
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() => send(receivePapers, "Papers received.")}
          >
            Receive papers
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
