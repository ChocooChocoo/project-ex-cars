"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Check, Eye, MoreHorizontal, Stamp, X } from "lucide-react";
import { toast } from "sonner";

import { approvePrice } from "@/app/(staff)/vehicles/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PriceProposalRow {
  id: string;
  vehicle_id: string;
  proposed_amount: number;
  notes: string | null;
  vehicles: { make: string | null; model: string | null; year: number | null } | null;
}

type Decision = "approved" | "rejected";

export function PendingApprovalsTable({ proposals }: { readonly proposals: PriceProposalRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [decisionTarget, setDecisionTarget] = useState<{ proposal: PriceProposalRow; decision: Decision } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDecision() {
    if (!decisionTarget) return;
    const { proposal, decision } = decisionTarget;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("proposal_id", proposal.id);
    fd.set("decision", decision);
    fd.set("vehicle_id", proposal.vehicle_id);
    const result = await approvePrice(fd);
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approved" ? "Price proposal approved." : "Price proposal rejected.");
    setDecisionTarget(null);
    router.refresh();
  }

  const columns: ColumnDef<PriceProposalRow>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => {
        const vehicle = row.original.vehicles;
        return (
          <div className="grid gap-0.5">
            <span className="font-medium">
              {vehicle ? `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() : row.original.vehicle_id.slice(0, 8)}
            </span>
            <span className="text-muted-foreground text-xs">{vehicle?.year ?? "—"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "proposed_amount",
      header: "Proposed Price",
      cell: ({ row }) => <span className="font-medium">₱{row.original.proposed_amount.toLocaleString()}</span>,
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.notes ?? "—"}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const proposal = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/vehicles/${proposal.vehicle_id}`}>
                  <Eye className="mr-2 size-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDecisionTarget({ proposal, decision: "approved" })}>
                <Check className="mr-2 size-4" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDecisionTarget({ proposal, decision: "rejected" })}
              >
                <X className="mr-2 size-4" />
                Reject
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: proposals,
    columns,
    state: { sorting, pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            <div className="flex items-center gap-2">
              <Stamp className="size-5 text-muted-foreground" />
              Pending Price Approvals
            </div>
          </CardTitle>
          <Badge variant="secondary" className="rounded-md">
            {proposals.length} pending
          </Badge>
        </CardHeader>
        <CardContent className="px-0">
          {proposals.length === 0 ? (
            <p className="px-4 text-muted-foreground text-sm">
              No price proposals awaiting approval. Marketing proposals appear here for CEO decision.
            </p>
          ) : (
            <DataTable table={table} rowsPerPageId="pending-approvals-rows-per-page" />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={decisionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDecisionTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decisionTarget?.decision === "approved" ? "Approve price proposal?" : "Reject price proposal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decisionTarget
                ? decisionTarget.decision === "approved"
                  ? `Approving sets the vehicle price to ₱${decisionTarget.proposal.proposed_amount.toLocaleString()} and makes it available for purchase.`
                  : "Rejecting moves the vehicle back to draft and leaves the current price unchanged."
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={decisionTarget?.decision === "rejected" ? "destructive" : "default"}
              onClick={handleDecision}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : decisionTarget?.decision === "approved" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
