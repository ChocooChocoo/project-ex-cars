"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { handPapersToBuyer, releasePapersToCi } from "@/app/(staff)/transactions/handover-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PAPERS_STATUS_LABELS, type PapersStatus } from "@/lib/transactions/buy-flow";

type Result = { error: string } | { success: true };

// Meet-up or delivery: the assigned Confidential Informant takes the papers out before the day and
// hands them to the buyer. The Mechanic and Head Security see the status only.
export function PapersCard({
  transactionId,
  papersStatus,
  canRecord,
}: {
  readonly transactionId: string;
  readonly papersStatus: PapersStatus | null;
  readonly canRecord: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle papers</CardTitle>
        <CardDescription>
          OR/CR, Deed of Sale and related documents. Only the assigned Confidential Informant records them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={inStore ? "outline" : "secondary"}>
            {papersStatus ? PAPERS_STATUS_LABELS[papersStatus] : "With the Confidential Informant"}
          </Badge>
        </p>
        {inStore ? (
          <p className="text-muted-foreground">Release the papers before the day. The car cannot leave without them.</p>
        ) : null}
        {canRecord && inStore ? (
          <Button
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() => send(releasePapersToCi, "Papers recorded as released to you.")}
          >
            Record papers released to me
          </Button>
        ) : null}
        {canRecord && papersStatus === "released_to_ci" ? (
          <Button
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() => send(handPapersToBuyer, "Papers handed to the buyer.")}
          >
            Hand papers to buyer
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
