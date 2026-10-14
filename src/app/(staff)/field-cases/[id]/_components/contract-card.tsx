"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  recordBuyerMet,
  recordContractCopy,
  reportCashReceived,
  reportSigning,
} from "@/app/(staff)/transactions/handover-actions";
import { ContractProgress } from "@/components/contract-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isDirectPayment, isHalfwayCashRequest, signsInApp } from "@/lib/transactions/buy-flow";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

// Meet-up or delivery day: the team records the buyer met, the signing, the signed copies they keep and
// the money, in that order. Each button appears only for the person who may press it, when it is due.
export function ContractCard({
  transactionId,
  details,
  handover,
  member,
}: {
  readonly transactionId: string;
  readonly details: Row | null;
  readonly handover: Row;
  readonly member: "informant" | "mechanic" | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signed = handover.contract_state === "signed";
  const keepsCopy = member === "informant" || (member === "mechanic" && isHalfwayCashRequest(details));
  const ownCopy = member === "informant" ? handover.ci_copy_at : handover.mechanic_copy_at;
  const waitsForApp = signsInApp(details) && !signed;

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
        <CardTitle>Contract and payment</CardTitle>
        <CardDescription>
          The buyer signs before any money changes hands and before the papers are handed over.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ContractProgress details={details} handover={handover} />
        {member && handover.buyer_met_at && waitsForApp ? (
          <p className="text-muted-foreground">The buyer signs this contract in the app on their own phone.</p>
        ) : null}
        {member ? (
          <div className="flex flex-wrap gap-2">
            {handover.buyer_met_at ? null : (
              <Button size="sm" disabled={busy} onClick={() => send(recordBuyerMet, "Buyer Met recorded.")}>
                Record Buyer Met
              </Button>
            )}
            {member === "informant" && handover.buyer_met_at && !handover.signing_reported_at && !waitsForApp ? (
              <Button size="sm" disabled={busy} onClick={() => send(reportSigning, "Signing reported to GCE.")}>
                Report contract signed
              </Button>
            ) : null}
            {keepsCopy && signed && !ownCopy ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => send(recordContractCopy, "Your signed copy is recorded.")}
              >
                Record my signed copy
              </Button>
            ) : null}
            {isDirectPayment(details) && signed && !handover.cash_reported_at ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => send(reportCashReceived, "Payment reported to the Sales Manager.")}
              >
                Report payment received
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
