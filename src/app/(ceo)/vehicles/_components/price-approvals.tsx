"use client";
"use no memo";

import { useRouter } from "next/navigation";

import { Check, Stamp, X } from "lucide-react";
import { toast } from "sonner";

import { approvePrice } from "@/app/(ceo)/vehicles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface PriceProposalRow {
  id: string;
  vehicle_id: string;
  proposed_amount: number;
  notes: string | null;
  vehicles: { make: string | null; model: string | null; year: number | null } | null;
}

export function PriceApprovals({ proposals }: { readonly proposals: PriceProposalRow[] }) {
  const router = useRouter();

  async function handleDecision(proposalId: string, vehicleId: string, decision: "approved" | "rejected") {
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    fd.set("decision", decision);
    fd.set("vehicle_id", vehicleId);
    const result = await approvePrice(fd);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approved" ? "Price proposal approved." : "Price proposal rejected.");
    router.refresh();
  }

  return (
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
      <CardContent>
        {proposals.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No price proposals awaiting approval. Marketing proposals appear here for CEO decision.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Proposed Price</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell className="font-medium">
                    {proposal.vehicles
                      ? `${proposal.vehicles.make ?? ""} ${proposal.vehicles.model ?? ""} (${proposal.vehicles.year ?? ""})`
                      : proposal.vehicle_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>₱{proposal.proposed_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{proposal.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDecision(proposal.id, proposal.vehicle_id, "rejected")}
                      >
                        <X data-icon="inline-start" />
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => handleDecision(proposal.id, proposal.vehicle_id, "approved")}>
                        <Check data-icon="inline-start" />
                        Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
