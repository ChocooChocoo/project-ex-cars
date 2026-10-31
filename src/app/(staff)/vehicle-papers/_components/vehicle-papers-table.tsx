"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { Check, FileText, MoreHorizontal, Printer } from "lucide-react";
import { toast } from "sonner";

import {
  approvePapersRelease,
  handPapersToBuyer,
  releasePapersToCi,
} from "@/app/(staff)/transactions/handover-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAPERS_STATUS_LABELS, type PapersStatus } from "@/lib/transactions/buy-flow";
import { type VehiclePapersAction, vehiclePapersAction } from "@/lib/transactions/vehicle-papers";

export interface VehiclePaperRow {
  readonly transactionId: string;
  readonly vehicle: string;
  readonly buyer: string;
  readonly status: PapersStatus;
  readonly arrangementKind: string | null;
  readonly updatedAt: string | null;
  readonly orcrUrl: string | null;
}

const STATUS_VARIANTS: Record<PapersStatus, "default" | "secondary" | "outline"> = {
  requested: "default",
  released_to_ci: "secondary",
  handed_over: "secondary",
  received: "secondary",
  returned: "outline",
};

const RELEASE_ACTIONS: Record<
  VehiclePapersAction,
  (formData: FormData) => Promise<{ error: string } | { success: true }>
> = {
  approve_release: approvePapersRelease,
  hand_to_buyer: handPapersToBuyer,
  release_to_ci: releasePapersToCi,
};

const RELEASE_MESSAGES: Record<VehiclePapersAction, string> = {
  approve_release: "Papers released to the Sales Manager.",
  hand_to_buyer: "Papers handed to the buyer.",
  release_to_ci: "Papers recorded as released to you.",
};

// The Confidential Informant's paper queue: the papers of a sold car, the request to hand them over
// and the two documents GCE prints. The OR/CR is the original physical copy, so it only opens.
export function VehiclePapersTable({
  rows,
  canRelease,
}: {
  readonly rows: VehiclePaperRow[];
  readonly canRelease: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<VehiclePaperRow | null>(null);

  async function release(row: VehiclePaperRow, action: VehiclePapersAction) {
    const formData = new FormData();
    formData.set("transaction_id", row.transactionId);
    setBusy(row.transactionId);
    const result = await RELEASE_ACTIONS[action](formData);
    setBusy(null);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(RELEASE_MESSAGES[action]);
      router.refresh();
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <div className="flex max-w-lg flex-col gap-1">
          <h2 className="font-medium">No paper requests yet</h2>
          <p className="text-muted-foreground text-sm">
            When a Sales Manager requests the OR/CR, Deed of Sale and Policy &amp; Warranty for a sold car, the request
            appears here for the Confidential Informant to release.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/15">
            <TableRow>
              <TableHead className="h-11 p-3 font-medium">Vehicle</TableHead>
              <TableHead className="hidden h-11 p-3 font-medium sm:table-cell">Buyer</TableHead>
              <TableHead className="h-11 p-3 font-medium">Status</TableHead>
              <TableHead className="h-11 p-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const action = vehiclePapersAction(row.status, { arrangement_kind: row.arrangementKind });
              const isReleased = row.status === "handed_over" || row.status === "received";

              return (
                <TableRow key={row.transactionId}>
                  <TableCell className="p-3 align-middle">
                    <span className="font-medium">{row.vehicle}</span>
                    <span className="block text-muted-foreground text-xs sm:hidden">for {row.buyer}</span>
                  </TableCell>
                  <TableCell className="hidden p-3 align-middle text-muted-foreground sm:table-cell">
                    {row.buyer}
                  </TableCell>
                  <TableCell className="p-3 align-middle">
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant={STATUS_VARIANTS[row.status]}>{PAPERS_STATUS_LABELS[row.status]}</Badge>
                      {row.updatedAt ? (
                        <span className="text-muted-foreground text-xs">
                          Updated {format(new Date(row.updatedAt), "MMM d, yyyy")}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="p-3 text-right align-middle">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for ${row.vehicle}`}
                          disabled={busy === row.transactionId}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setViewing(row)}>
                          <FileText data-icon="inline-start" />
                          View papers
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/vehicle-papers/${row.transactionId}/deed-of-sale`}>
                            <Printer data-icon="inline-start" />
                            Print Deed of Sale
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/vehicle-papers/${row.transactionId}/policy-warranty`}>
                            <Printer data-icon="inline-start" />
                            Print Policy &amp; Warranty
                          </Link>
                        </DropdownMenuItem>
                        {canRelease && action ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => release(row, action)}>
                              <Check data-icon="inline-start" />
                              Mark Released
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {isReleased ? (
                          <DropdownMenuItem disabled>
                            <Check data-icon="inline-start" />
                            Released
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={viewing !== null} onOpenChange={(open) => (open ? null : setViewing(null))}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-5">
            <SheetTitle>Vehicle papers</SheetTitle>
            <SheetDescription>
              {viewing ? `${viewing.vehicle} for ${viewing.buyer}` : "The papers for a sold car."}
            </SheetDescription>
          </SheetHeader>
          {viewing ? (
            <div className="flex flex-col gap-3 p-5 text-sm">
              <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">OR/CR</span>
                    <span className="text-muted-foreground text-xs">Original OR/CR — hand over the physical copy.</span>
                  </div>
                  {viewing.orcrUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={viewing.orcrUrl} target="_blank" rel="noopener noreferrer">
                        <FileText data-icon="inline-start" />
                        View OR/CR
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">Physical OR/CR kept by CI</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col divide-y rounded-lg border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Deed of Sale</span>
                    <span className="text-muted-foreground text-xs">
                      Filled in with the buyer and the car on record.
                    </span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/vehicle-papers/${viewing.transactionId}/deed-of-sale`}>
                      <Printer data-icon="inline-start" />
                      Print
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Policy &amp; Warranty</span>
                    <span className="text-muted-foreground text-xs">The warranty terms for this car.</span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/vehicle-papers/${viewing.transactionId}/policy-warranty`}>
                      <Printer data-icon="inline-start" />
                      Print
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
