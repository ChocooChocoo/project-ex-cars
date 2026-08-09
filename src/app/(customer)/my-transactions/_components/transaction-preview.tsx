"use client";
"use no memo";

import * as React from "react";

import { Printer } from "lucide-react";

import { INVOICE_PAPER_HEIGHT, INVOICE_PAPER_SCALE, INVOICE_PAPER_WIDTH } from "@/app/(staff)/invoice/_components/data";
import { useVisibleCenterPosition } from "@/app/(staff)/invoice/_components/use-visible-center-position";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

import { PrintTransaction } from "./print-transaction";
import { TransactionPaper, type TransactionPaperProps } from "./transaction-paper";

export function TransactionPreview({ paper }: { readonly paper: TransactionPaperProps }) {
  const previewBodyRef = React.useRef<HTMLDivElement>(null);
  const paperLayout = useVisibleCenterPosition(previewBodyRef, {
    height: INVOICE_PAPER_HEIGHT,
    maxScale: INVOICE_PAPER_SCALE,
    width: INVOICE_PAPER_WIDTH,
  });

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <PrintTransaction paper={paper} />
      <div className="flex flex-col rounded-xl border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="font-medium text-lg">Preview</h2>
          <ButtonGroup>
            <Button type="button" variant="outline" onClick={handlePrint}>
              <Printer data-icon="inline-start" />
              Print
            </Button>
          </ButtonGroup>
        </div>

        <div
          ref={previewBodyRef}
          className="@container/preview relative min-h-[calc(100svh-15rem)] flex-1 rounded-b-xl bg-stone-200 p-4 dark:bg-stone-800"
        >
          {paperLayout === null ? (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
              Loading Preview
            </div>
          ) : null}
          <div
            style={{
              height: paperLayout
                ? INVOICE_PAPER_HEIGHT * paperLayout.scale
                : INVOICE_PAPER_HEIGHT * INVOICE_PAPER_SCALE,
              top: paperLayout?.top ?? "50%",
              transform: paperLayout === null ? "translate(-50%, -50%)" : "translateX(-50%)",
              width: paperLayout ? INVOICE_PAPER_WIDTH * paperLayout.scale : INVOICE_PAPER_WIDTH * INVOICE_PAPER_SCALE,
            }}
            className="absolute left-1/2 opacity-0 data-[ready=true]:opacity-100"
            data-ready={paperLayout !== null}
          >
            <div
              style={{ transform: `scale(${paperLayout?.scale ?? INVOICE_PAPER_SCALE})` }}
              className="origin-top-left"
            >
              <TransactionPaper {...paper} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
