"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  receivePapers,
  requestPapersRelease,
  reviewContract,
  saveContract,
} from "@/app/(staff)/transactions/handover-actions";
import { ContractProgress } from "@/components/contract-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTRACT_STATE_LABELS,
  type ContractState,
  isFieldArrangement,
  PAPERS_STATUS_LABELS,
  type PapersStatus,
  signsInApp,
} from "@/lib/transactions/buy-flow";

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

// Contract: nothing is paid, handed over or marked sold before it is signed. For financing at a GCE
// visit or a meet-up the Sales Manager writes it here and the Head Accountant approves it; everywhere
// else it is signed on paper in the field, so this card only reports.
export function ContractCard({
  transactionId,
  details,
  handover,
  template,
  open,
  userRole,
}: {
  readonly transactionId: string;
  readonly details: Record<string, unknown> | null;
  readonly handover: Record<string, unknown>;
  readonly template: string;
  readonly open: boolean;
  readonly userRole: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState(String(handover.contract_body ?? ""));
  const [reason, setReason] = useState("");

  const inApp = signsInApp(details);
  const state = (handover.contract_state as ContractState | null | undefined) ?? null;
  const canWrite =
    open &&
    inApp &&
    ["sales_manager", "ceo"].includes(userRole) &&
    (!state || state === "draft" || state === "returned");
  const canReview = open && userRole === "head_accountant" && state === "pending_approval";
  const savedBody = String(handover.contract_body ?? "");

  async function send(action: (fd: FormData) => Promise<Result>, fields: Record<string, string>, message: string) {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    for (const [key, value] of Object.entries(fields)) fd.set(key, value);
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
        <CardTitle>Contract</CardTitle>
        <CardDescription>
          {inApp
            ? "The Sales Manager writes it, the Head Accountant approves it, then the buyer signs it. No payment is recorded before the signature."
            : "The buyer signs the printed contract at the meet-up or on delivery, and the Confidential Informant reports it. No payment is recorded before the signature."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={state === "signed" ? "secondary" : "outline"}>
            {state ? CONTRACT_STATE_LABELS[state] : inApp ? "Not written yet" : "Waiting for signing in the field"}
          </Badge>
        </p>

        {state === "returned" && handover.contract_returned_reason ? (
          <p>
            <span className="text-muted-foreground">Returned by the Head Accountant: </span>
            {String(handover.contract_returned_reason)}
          </p>
        ) : null}

        {canWrite ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="contract-body">Contract text</Label>
              {body.trim() ? null : (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setBody(template)}>
                  Start from the pre-made contract
                </Button>
              )}
            </div>
            <Textarea
              id="contract-body"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-describedby="contract-body-hint"
            />
            <p id="contract-body-hint" className="text-muted-foreground text-xs">
              State the contract length and that GCE takes back the vehicle if it is not paid for.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy || !body.trim()}
                onClick={() => send(saveContract, { body, submit: "1" }, "Contract sent to the Head Accountant.")}
              >
                Send for approval
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !body.trim()}
                onClick={() => send(saveContract, { body }, "Draft saved.")}
              >
                Save draft
              </Button>
            </div>
          </div>
        ) : savedBody ? (
          <section aria-label="Contract text" className="whitespace-pre-wrap rounded-md border p-3">
            {savedBody}
          </section>
        ) : null}

        {canReview ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <Button
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() => send(reviewContract, { decision: "approve" }, "Contract approved. The buyer can sign it.")}
            >
              Approve contract
            </Button>
            <Label htmlFor="contract-return-reason">What to revise</Label>
            <Textarea id="contract-return-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              disabled={busy || !reason.trim()}
              onClick={() =>
                send(reviewContract, { decision: "return", reason }, "Contract returned to the Sales Manager.")
              }
            >
              Return for revision
            </Button>
          </div>
        ) : null}

        {state === "pending_approval" && !canReview ? (
          <p className="text-muted-foreground">Waiting for the Head Accountant to approve or return it.</p>
        ) : null}
        {state === "approved" ? <p className="text-muted-foreground">Waiting for the buyer to sign.</p> : null}

        {state === "signed" || isFieldArrangement(details) ? (
          <ContractProgress details={details} handover={handover} />
        ) : null}
      </CardContent>
    </Card>
  );
}
