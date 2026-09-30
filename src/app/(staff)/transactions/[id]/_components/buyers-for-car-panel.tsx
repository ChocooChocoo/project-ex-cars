"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import { promoteQueuedRequest } from "@/app/(staff)/transactions/actions";
import { TransactionStatusBadge } from "@/components/transaction-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FlowStatus, QueueState, TransactionFlag, TransactionState } from "@/lib/transactions/state-machine";

export interface CarBuyerRow {
  id: string;
  current_state: TransactionState;
  queue_state: QueueState | null;
  flow_status: FlowStatus | null;
  flag: TransactionFlag | null;
  review_due_at: string | null;
  opened_at: string;
  profiles: { full_name: string | null } | null;
}

// §3 step 5: every open request for this car, so the Sales Manager can pick the next On Hold one by hand.
export function BuyersForCarPanel({
  currentId,
  buyers,
  canPromote,
}: {
  readonly currentId: string;
  readonly buyers: CarBuyerRow[];
  readonly canPromote: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const hasActive = buyers.some((buyer) => buyer.queue_state === "active");

  async function promote(id: string) {
    setBusyId(id);
    const fd = new FormData();
    fd.set("transaction_id", id);
    const result = await promoteQueuedRequest(fd);
    setBusyId(null);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Request is now Active.");
      router.refresh();
    }
  }

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Buyers for this car</CardTitle>
        <CardDescription>
          One request is Active at a time. After a rejection, no-show or decline, promote the next On Hold request.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {buyers.map((buyer) => (
          <div key={buyer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
            <div className="flex flex-col">
              <Link href={`/dashboard/transactions/${buyer.id}`} className="font-medium underline">
                {buyer.profiles?.full_name ?? buyer.id.slice(0, 8)}
                {buyer.id === currentId ? " (this request)" : ""}
              </Link>
              <span className="text-muted-foreground text-xs">
                Requested {format(new Date(buyer.opened_at), "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TransactionStatusBadge
                state={buyer.current_state}
                flowStatus={buyer.flow_status}
                flag={buyer.flag}
                reviewDueAt={buyer.review_due_at}
                queueState={buyer.queue_state}
              />
              {canPromote && buyer.queue_state === "on_hold" ? (
                <Button size="sm" disabled={hasActive || busyId === buyer.id} onClick={() => promote(buyer.id)}>
                  Make Active
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
