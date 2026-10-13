"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { approvePapersRelease } from "@/app/(staff)/transactions/handover-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface PapersRequestRow {
  readonly transactionId: string;
  readonly buyer: string;
  readonly vehicle: string;
}

// GCE visit sales: the Sales Manager asked for the papers of a car; the Confidential Informant
// approves and hands them over here.
export function PapersRequests({ requests }: { readonly requests: PapersRequestRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(transactionId: string) {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    setBusy(transactionId);
    const result = await approvePapersRelease(fd);
    setBusy(null);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Papers handed over to the Sales Manager.");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle papers requests</CardTitle>
        <CardDescription>
          The Sales Manager asks for the papers of a car after the buyer has paid. Approve, then hand them over.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {requests.length === 0 ? (
          <p className="text-muted-foreground">No papers requests are waiting.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {requests.map((request) => (
              <li
                key={request.transactionId}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <p>
                  <span className="font-medium">{request.vehicle}</span>
                  <span className="text-muted-foreground"> for {request.buyer}</span>
                </p>
                <Button
                  size="sm"
                  className="self-start sm:self-auto"
                  disabled={busy === request.transactionId}
                  onClick={() => approve(request.transactionId)}
                >
                  Approve and hand over
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
