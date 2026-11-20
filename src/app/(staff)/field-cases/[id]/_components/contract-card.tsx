"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  recordBuyerMet,
  recordContractCopy,
  recordFieldSignatures,
  reportSigning,
} from "@/app/(staff)/transactions/handover-actions";
import { ContractProgress } from "@/components/contract-progress";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signsInApp } from "@/lib/transactions/buy-flow";
import { MISSED_PAYMENT_POLICY, MISSED_PAYMENT_POLICY_LABEL } from "@/lib/transactions/missed-payment-policy";

type Row = Record<string, unknown>;
type Result = { error: string } | { success: true };

// Meet-up or delivery day: the team records the buyer met, the signing and the signed copy the Confidential
// Informant keeps, in that order. T10: no payment is recorded in the field; the buyer pays in the app or at GCE. Each button appears only for the person who may press it, when it is due.
// T11: the buyer and the Confidential Informant sign on the device here, and both signature images are kept
// with the sale.
// BH-2: the contract belongs to the Confidential Informant on a field arrangement; the Mechanic keeps no signed
// copy, so `member` is only ever "informant" (or null for a reader who may not act).
export function ContractCard({
  transactionId,
  details,
  handover,
  member,
}: {
  readonly transactionId: string;
  readonly details: Row | null;
  readonly handover: Row;
  readonly member: "informant" | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [buyerSignature, setBuyerSignature] = useState<HTMLCanvasElement | null>(null);
  const [ciSignature, setCiSignature] = useState<HTMLCanvasElement | null>(null);
  const signed = handover.contract_state === "signed";
  const keepsCopy = member === "informant";
  const ownCopy = handover.ci_copy_at;
  const waitsForApp = signsInApp(details) && !signed;
  const financed = details?.payment_method === "financing";
  const canSign = member === "informant" && !signed;

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

  async function sign() {
    if (!buyerSignature || !ciSignature) return;
    setBusy(true);
    try {
      const [buyerBlob, ciBlob] = await Promise.all([
        new Promise<Blob | null>((resolve) => buyerSignature.toBlob(resolve, "image/png")),
        new Promise<Blob | null>((resolve) => ciSignature.toBlob(resolve, "image/png")),
      ]);
      if (!buyerBlob || !ciBlob) {
        toast.error("Could not read a signature. Draw it again.");
        return;
      }
      // The server stores both PNGs: the Confidential Informant has no upload policy on the document bucket.
      const fd = new FormData();
      fd.set("transaction_id", transactionId);
      fd.set("buyer_signature", new File([buyerBlob], "signature-buyer.png", { type: "image/png" }));
      fd.set("ci_signature", new File([ciBlob], "signature-ci.png", { type: "image/png" }));
      const result = await recordFieldSignatures(fd);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Contract signed by the buyer and the Confidential Informant.");
      setBuyerSignature(null);
      setCiSignature(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract</CardTitle>
        <CardDescription>
          The buyer signs before any money changes hands and before the papers are handed over.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ContractProgress details={details} handover={handover} />
        {member && handover.buyer_met_at && waitsForApp ? (
          <p className="text-muted-foreground">The buyer signs this contract in the app on their own phone.</p>
        ) : null}
        {signed ? <p>Signed by the buyer and the Confidential Informant.</p> : null}
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
          </div>
        ) : null}

        {canSign ? (
          <div className="flex flex-col gap-3 border-t pt-3">
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">Buyer signature</p>
              <SignaturePad onChange={setBuyerSignature} />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">Your signature (Confidential Informant)</p>
              <SignaturePad onChange={setCiSignature} />
            </div>
            <Button size="sm" className="self-start" disabled={busy || !buyerSignature || !ciSignature} onClick={sign}>
              Record signatures
            </Button>
          </div>
        ) : null}

        {financed ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <p className="font-medium">{MISSED_PAYMENT_POLICY_LABEL}</p>
            <p className="text-muted-foreground">{MISSED_PAYMENT_POLICY}</p>
            <Button asChild size="sm" variant="outline" className="self-start">
              <Link href={`/vehicle-papers/${transactionId}/missed-payment-policy`}>Print policy</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
