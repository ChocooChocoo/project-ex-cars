"use client";

import { useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { handPapersToBuyer, releasePapersToCi, uploadFieldDocument } from "@/app/(staff)/transactions/handover-actions";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAPERS_STATUS_LABELS, type PapersStatus } from "@/lib/transactions/buy-flow";
import { compressFormFiles } from "@/lib/uploads/compress-image";

type Result = { error: string } | { success: true };

export interface PaperDocumentRow {
  readonly id: string;
  readonly document_kind: string;
  readonly source: "previous_owner" | "gce" | "ci";
  readonly label: string;
  readonly uploaded_at: string | null;
  readonly signed_url: string | null;
  readonly is_image: boolean;
  readonly note?: string | null;
}

const SOURCE_LABELS: Record<PaperDocumentRow["source"], string> = {
  previous_owner: "Previous owner",
  gce: "GCE",
  ci: "Confidential Informant",
};

// The kinds the Confidential Informant may file against a sale. "Other" covers a paper GCE has no kind for;
// the note says what it is.
const UPLOAD_KINDS = [
  { value: "orcr", label: "OR/CR" },
  { value: "official_receipt", label: "Official Receipt (OR)" },
  { value: "certificate_of_registration", label: "Certificate of Registration (CR)" },
  { value: "deed_of_sale", label: "Deed of Sale" },
  { value: "sale_document", label: "Sale document" },
  { value: "other", label: "Other" },
];

// Meet-up or delivery: the assigned Confidential Informant takes the papers out before the day and
// hands them to the buyer. The Mechanic and Head Security see the status only.
export function PapersCard({
  transactionId,
  papersStatus,
  canRecord,
  documents,
  canUpload,
  deedHref,
}: {
  readonly transactionId: string;
  readonly papersStatus: PapersStatus | null;
  readonly canRecord: boolean;
  readonly documents: PaperDocumentRow[];
  readonly canUpload: boolean;
  readonly deedHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("orcr");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
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

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Attach the document.");
      return;
    }
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    fd.set("document_kind", kind);
    fd.set("note", note);
    fd.set("file", file);
    setBusy(true);
    const result = await uploadFieldDocument(await compressFormFiles(fd));
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Document added to the sale.");
    setNote("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
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

        <div className="flex flex-col gap-2 border-t pt-3">
          <h3 className="font-medium">Papers on this sale</h3>
          {documents.length === 0 ? <p className="text-muted-foreground">No papers on file yet.</p> : null}
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex items-start gap-2 rounded-md border px-2.5 py-2"
              data-testid={`paper-document-${document.id}`}
            >
              {document.is_image && document.signed_url ? (
                <TransactionImagePreview
                  src={document.signed_url}
                  alt={`${document.label} preview`}
                  triggerClassName="h-16 w-24"
                />
              ) : (
                <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                  <FileText className="size-5 text-muted-foreground" aria-hidden />
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{document.label}</span>
                <span className="text-muted-foreground text-xs">
                  {SOURCE_LABELS[document.source]}
                  {document.uploaded_at ? ` · ${format(new Date(document.uploaded_at), "MMM d, yyyy")}` : ""}
                </span>
                {document.note ? <span className="text-xs">{document.note}</span> : null}
                {document.signed_url ? (
                  <a
                    href={document.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-xs underline"
                  >
                    Open
                  </a>
                ) : null}
              </div>
            </div>
          ))}

          <Link
            href={deedHref}
            className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 hover:bg-muted/40"
          >
            <span>
              <span className="font-medium">GCE Deed of Sale</span>
              <span className="block text-muted-foreground text-xs">
                Filled in from this sale. Print it for the buyer.
              </span>
            </span>
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>

        {canUpload ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <h3 className="font-medium">Add document</h3>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="document-kind">Kind of document</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="document-kind" aria-label="Kind of document">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UPLOAD_KINDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="document-note">Note</Label>
              <Input
                id="document-note"
                placeholder="e.g. OR from the previous owner"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Input
              ref={fileRef}
              type="file"
              aria-label="Document file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
            />
            <Button size="sm" className="self-start" disabled={busy} onClick={upload}>
              Add document
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
