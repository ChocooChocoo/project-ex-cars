import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PaperDocument } from "@/lib/papers/templates";

import { PaperSheet } from "./paper-sheet";
import { PrintDocumentButton } from "./print-document-button";
import { PrintPaper } from "./print-paper";

// The screen around a printable paper: how to get back, what the CI is looking at, the sheet itself and
// the print copy. The copy is portalled so the app chrome never reaches the printer.
export function PaperDocumentView({
  paper,
  heading,
  note,
}: {
  readonly paper: PaperDocument;
  readonly heading: string;
  readonly note: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground">
            <Link href="/vehicle-papers">
              <ArrowLeft data-icon="inline-start" />
              Vehicle Papers
            </Link>
          </Button>
          <div className="flex flex-col gap-1">
            <h1 className="font-semibold text-2xl tracking-tight">{heading}</h1>
            <p className="max-w-2xl text-muted-foreground text-sm">{note}</p>
          </div>
        </div>
        <PrintDocumentButton label="Print" />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-muted/30 p-4 sm:p-8">
        <PaperSheet paper={paper} className="mx-auto shadow-sm" />
      </div>

      <PrintPaper>
        <PaperSheet paper={paper} />
      </PrintPaper>
    </div>
  );
}
