"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { RejectReasonDialog } from "@/components/reject-reason-dialog";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { transactionDocumentLabel } from "@/lib/transactions/document-media";
import { SELL_PAPER_KINDS } from "@/lib/transactions/sell-flow";
import { SELL_PAPER_FIELDS, SELL_PAPER_STATUS_LABELS } from "@/lib/vehicles/catalog";

// T03 C11/SM2: result of the automatic OR/CR and ID check. Advisory only; staff Verify stays the decision.
const AUTO_CHECK_LABELS: Record<string, string> = {
  verified: "Auto-check: verified",
  failed: "Auto-check: failed",
  manual_review: "Auto-check: needs manual review",
};

// SN-13: the seller now declares the OR, the CR and the deed of sale instead of uploading them, so the Marketing
// Specialist reads the answers here and inspects the originals at the meet-up.
function SellerPapersChecklist({ checklist }: { readonly checklist: Record<string, unknown> }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3" aria-label="Seller's papers checklist">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-sm">Seller&apos;s papers checklist</h3>
        <span className="text-muted-foreground text-xs">Originals are checked at the meet-up.</span>
      </div>
      <dl className="grid gap-2 sm:grid-cols-3">
        {SELL_PAPER_FIELDS.map((paper) => {
          const status = checklist[paper.key];
          return (
            <div key={paper.key} className="flex flex-col gap-1 text-sm">
              <dt className="text-muted-foreground text-xs">{paper.label}</dt>
              <dd>
                {typeof status === "string" && status in SELL_PAPER_STATUS_LABELS ? (
                  <Badge
                    variant={status === "does_not_have" ? "destructive" : "secondary"}
                    className="h-5 px-2 text-[11px]"
                  >
                    {SELL_PAPER_STATUS_LABELS[status as keyof typeof SELL_PAPER_STATUS_LABELS]}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">Not answered</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

// T03 SM1/HA1: customer documents get the full page width (was the narrow sidebar), in a 1/2/3-column grid,
// so staff can check several IDs and papers side by side.
export function TransactionDocumentsCard({
  kind,
  userRole,
  documents,
  papersChecklist = null,
  onVerifyDocument,
  onRejectDocument,
}: {
  readonly kind: string;
  readonly userRole: string;
  readonly documents: Record<string, unknown>[];
  /** SN-13: `sell_details.papers_checklist` of a sell offer, when the seller answered one. */
  readonly papersChecklist?: Record<string, unknown> | null;
  readonly onVerifyDocument: (documentId: string) => Promise<void>;
  readonly onRejectDocument: (documentId: string, reason: string) => Promise<void>;
}) {
  // Same rules as the server guard in verifyTransactionDocument: the Marketing Specialist checks a seller's
  // papers, the Sales Manager a buyer's IDs and proof of billing, the Head Accountant everything else.
  const canVerify = (documentKind: unknown) =>
    kind === "sell" && (SELL_PAPER_KINDS as readonly unknown[]).includes(documentKind)
      ? userRole === "marketing_specialist"
      : userRole === "head_accountant" ||
        (userRole === "sales_manager" &&
          kind === "buy" &&
          ["valid_id", "proof_of_billing"].includes(String(documentKind)));

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
        {/* SN-13: the seller's answers above the uploads; an older offer that sent OR/CR/Deed files has none. */}
        {kind === "sell" && papersChecklist ? <SellerPapersChecklist checklist={papersChecklist} /> : null}
        {/* T10: only the buyer uploads IDs and proof of billing; staff verify them here. */}
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
                  {doc.id_side ? (
                    <Badge variant="outline" className="h-5 w-fit px-2 text-[11px] capitalize">
                      {doc.id_side as string}
                    </Badge>
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
                  {typeof doc.auto_check_status === "string" && AUTO_CHECK_LABELS[doc.auto_check_status] ? (
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={doc.auto_check_status === "failed" ? "destructive" : "outline"}
                        className="h-5 px-2 text-[11px]"
                      >
                        {AUTO_CHECK_LABELS[doc.auto_check_status]}
                      </Badge>
                      {doc.auto_check_detail ? (
                        <p className="text-muted-foreground text-xs">{doc.auto_check_detail as string}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {doc.verification_state === "pending" && canVerify(doc.document_kind) ? (
                    <div className="mt-auto flex gap-1.5">
                      <ConfirmDialog
                        action="approve"
                        title="Are you sure you want to verify this document?"
                        confirmLabel="Verify"
                        onConfirm={() => onVerifyDocument(id)}
                        trigger={
                          <Button size="sm" className="h-8 px-2.5 text-xs">
                            Verify
                          </Button>
                        }
                      />
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
