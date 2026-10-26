"use client";

import { useRef, useState } from "react";

import { toast } from "sonner";

import { RejectReasonDialog } from "@/components/reject-reason-dialog";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCEPTED_ID_TYPES, ID_LABELS } from "@/lib/auth/roles";
import { transactionDocumentLabel } from "@/lib/transactions/document-media";
import { SELL_PAPER_KINDS } from "@/lib/transactions/sell-flow";

// T03 SM1/HA1: customer documents get the full page width (was the narrow sidebar), in a 1/2/3-column grid,
// so staff can check several IDs and papers side by side.
export function TransactionDocumentsCard({
  kind,
  userRole,
  documents,
  onUploadDocument,
  onVerifyDocument,
  onRejectDocument,
}: {
  readonly kind: string;
  readonly userRole: string;
  readonly documents: Record<string, unknown>[];
  readonly onUploadDocument: (documentKind: string, idType: string, file: File) => Promise<void>;
  readonly onVerifyDocument: (documentId: string) => Promise<void>;
  readonly onRejectDocument: (documentId: string, reason: string) => Promise<void>;
}) {
  const [docKind, setDocKind] = useState("valid_id");
  const [docIdType, setDocIdType] = useState("");
  const docFileRef = useRef<HTMLInputElement>(null);

  const isCeo = userRole === "ceo";
  // Same rules as the server guard in verifyTransactionDocument: the Marketing Specialist checks a seller's
  // papers, the Sales Manager a buyer's IDs and proof of billing, the Head Accountant everything else.
  const canVerify = (documentKind: unknown) =>
    kind === "sell" && (SELL_PAPER_KINDS as readonly unknown[]).includes(documentKind)
      ? userRole === "marketing_specialist"
      : userRole === "head_accountant" ||
        (userRole === "sales_manager" &&
          kind === "buy" &&
          ["valid_id", "proof_of_billing"].includes(String(documentKind)));

  async function handleUpload() {
    const file = docFileRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file to upload.");
      return;
    }
    if (docKind === "valid_id" && !docIdType) {
      toast.error("Select the ID type.");
      return;
    }
    await onUploadDocument(docKind, docIdType, file);
    if (docFileRef.current) docFileRef.current.value = "";
  }

  return (
    <Card className="min-w-0 shadow-xs">
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          IDs, proof of billing and papers the customer submitted. Click an image to enlarge it.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-medium tabular-nums">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {kind === "buy" && !isCeo && (
          <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 p-3">
            <div className="flex min-w-40 flex-col gap-1.5">
              <Label htmlFor="doc-kind" className="text-xs">
                Document
              </Label>
              <Select
                value={docKind}
                onValueChange={(v) => {
                  setDocKind(v);
                  if (v !== "valid_id") setDocIdType("");
                }}
              >
                <SelectTrigger id="doc-kind" className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valid_id">Valid ID</SelectItem>
                  <SelectItem value="proof_of_billing">Proof of Billing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {docKind === "valid_id" ? (
              <div className="flex min-w-40 flex-col gap-1.5">
                <Label htmlFor="doc-id-type" className="text-xs">
                  ID type
                </Label>
                <Select value={docIdType} onValueChange={setDocIdType}>
                  <SelectTrigger id="doc-id-type" className="h-8 w-full text-xs">
                    <SelectValue placeholder="ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCEPTED_ID_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ID_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor="doc-file" className="text-xs">
                File
              </Label>
              <Input
                id="doc-file"
                ref={docFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="h-8 w-full text-xs"
              />
            </div>
            <Button size="sm" className="h-8" onClick={handleUpload}>
              Upload
            </Button>
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No documents.</p>
        ) : (
          <ul aria-label="Customer documents" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((doc) => {
              const label = transactionDocumentLabel(doc.document_kind);
              const signedUrl = typeof doc.signed_url === "string" ? doc.signed_url : null;
              const id = doc.id as string;
              return (
                <li key={id} className="flex flex-col gap-2 rounded-md border bg-background/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{label}</span>
                    <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                      {doc.verification_state as string}
                    </Badge>
                  </div>
                  {doc.id_type ? (
                    <p className="text-muted-foreground text-xs capitalize">
                      {(doc.id_type as string).replace(/_/g, " ")}
                    </p>
                  ) : null}
                  {signedUrl ? (
                    doc.is_image === true ? (
                      <TransactionImagePreview src={signedUrl} alt={`${label} document preview`} />
                    ) : (
                      <a href={signedUrl} target="_blank" rel="noreferrer" className="text-primary text-xs underline">
                        Open {label.toLowerCase()}
                      </a>
                    )
                  ) : (
                    <p className="text-muted-foreground text-xs">Preview unavailable</p>
                  )}
                  {doc.verification_state === "rejected" && doc.rejection_reason ? (
                    <p className="text-muted-foreground text-xs">To fix: {doc.rejection_reason as string}</p>
                  ) : null}
                  {doc.verification_state === "pending" && canVerify(doc.document_kind) ? (
                    <div className="mt-auto flex gap-1.5">
                      <Button size="sm" className="h-8 px-2.5 text-xs" onClick={() => onVerifyDocument(id)}>
                        Verify
                      </Button>
                      <RejectReasonDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            aria-label={`Ask to resubmit ${label}`}
                          >
                            Ask to resubmit
                          </Button>
                        }
                        title={`Ask for a new ${label}?`}
                        description="The uploader is notified with your note and uploads a replacement. Approval stays blocked until it is verified."
                        label="What to fix"
                        placeholder="e.g. The photo is blurred; retake it in good light"
                        confirmLabel="Ask to resubmit"
                        onConfirm={(reason) => onRejectDocument(id, reason)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
