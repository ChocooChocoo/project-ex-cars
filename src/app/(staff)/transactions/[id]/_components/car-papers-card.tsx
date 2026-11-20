"use client";

import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { transactionDocumentLabel } from "@/lib/transactions/document-media";
import { PAPERS_CUSTODY_LABELS, type PapersCustodyState } from "@/lib/transactions/vehicle-papers";

type CarPapers = {
  seller: string | null;
  custodyState: PapersCustodyState | null;
  documents: { id: string; document_kind: string; id_side: string | null; note: string | null; url: string | null }[];
};

// BC-7: on a buy request, the papers GCE received with the car — OR, CR, the previous owner's Deed of Sale and
// the seller's ID copies — as short-lived links. Sales Manager, CEO, CI and Head Accountant.
export function CarPapersCard({ transactionId }: { readonly transactionId: string }) {
  const page = usePageData(`car-papers/${transactionId}`, () =>
    browserApi<CarPapers>("GET", `/api/v1/staff/transactions/${encodeURIComponent(transactionId)}/car-papers`),
  );
  if (page.error || !page.data) return null;
  const { seller, custodyState, documents } = page.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Papers from the previous owner</CardTitle>
        <CardDescription>
          The OR, CR, Deed of Sale and ID copies GCE received {seller ? `from ${seller}` : "with this car"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {custodyState ? (
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Originals</span>
            <Badge variant="outline">{PAPERS_CUSTODY_LABELS[custodyState]}</Badge>
          </p>
        ) : null}
        {documents.length === 0 ? (
          <p className="text-muted-foreground">No papers on record for this car yet.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="min-w-0">
                  {transactionDocumentLabel(doc.document_kind)}
                  {doc.id_side ? ` (${doc.id_side})` : ""}
                  {doc.note ? <span className="block text-muted-foreground text-xs">{doc.note}</span> : null}
                </span>
                {doc.url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Eye data-icon="inline-start" />
                      View
                    </a>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
