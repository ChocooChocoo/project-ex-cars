"use client";

import { format } from "date-fns";
import { Eye, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAPERS_CUSTODY_LABELS, type SellerPapersRow } from "@/lib/transactions/vehicle-papers";

// Opens one photo in a bare window and prints it, so the CI can print a paper without the app chrome.
function printPhoto(url: string, label: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const img = win.document.createElement("img");
  img.src = url;
  img.alt = label;
  img.style.maxWidth = "100%";
  img.onload = () => win.print();
  win.document.title = label;
  win.document.body.append(img);
}

// SN-4 "From sellers": the original OR, CR and Deed of Sale each seller gave GCE, with the photo the Marketing
// Specialist captured and where the originals are now.
export function SellerPapersTable({ rows }: { readonly rows: SellerPapersRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <div className="flex max-w-lg flex-col gap-1">
          <h2 className="font-medium">No papers from sellers yet</h2>
          <p className="text-muted-foreground text-sm">
            After GCE pays a seller, the Marketing Specialist photographs the OR, CR and Deed of Sale and sends them
            here. Keep the originals until a buyer&apos;s sale releases them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="bg-muted/15">
          <TableRow>
            <TableHead className="h-11 p-3 font-medium">Vehicle</TableHead>
            <TableHead className="hidden h-11 p-3 font-medium sm:table-cell">Seller</TableHead>
            <TableHead className="h-11 p-3 font-medium">Status</TableHead>
            <TableHead className="h-11 p-3 font-medium">Papers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.vehicle_id}>
              <TableCell className="p-3 align-top">
                <span className="font-medium">{row.vehicle}</span>
                <span className="block text-muted-foreground text-xs sm:hidden">from {row.seller ?? "the seller"}</span>
                {row.received_at ? (
                  <span className="block text-muted-foreground text-xs">
                    Received {format(new Date(row.received_at), "MMM d, yyyy")}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="hidden p-3 align-top text-muted-foreground sm:table-cell">
                {row.seller ?? "—"}
              </TableCell>
              <TableCell className="p-3 align-top">
                <Badge variant={row.custody_state === "with_ci" ? "outline" : "secondary"}>
                  {PAPERS_CUSTODY_LABELS[row.custody_state]}
                </Badge>
              </TableCell>
              <TableCell className="p-3 align-top">
                <ul className="flex flex-col gap-2">
                  {row.papers.map((paper) => (
                    <li key={paper.document_kind} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 text-sm">{paper.label}</span>
                      {paper.url ? (
                        <span className="flex gap-1">
                          <Button asChild size="sm" variant="outline">
                            <a href={paper.url} target="_blank" rel="noopener noreferrer">
                              <Eye data-icon="inline-start" />
                              View
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => (paper.url ? printPhoto(paper.url, paper.label) : null)}
                          >
                            <Printer data-icon="inline-start" />
                            Print
                          </Button>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
