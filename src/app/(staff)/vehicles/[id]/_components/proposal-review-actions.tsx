"use client";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { approvePrice } from "@/app/(staff)/vehicles/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RejectReasonDialog } from "@/components/reject-reason-dialog";
import { Button } from "@/components/ui/button";

// T06: the CEO decides a price inside the vehicle view. Request Revision sends it back to the Marketing
// Specialist with a reason; the car returns to draft (or to repairing for a reprice).
export function ProposalReviewActions({
  proposalId,
  amount,
}: {
  readonly proposalId: string;
  readonly amount: number;
}) {
  const router = useRouter();

  async function decide(decision: "approved" | "rejected", notes = "") {
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    fd.set("decision", decision);
    if (notes) fd.set("decision_notes", notes);
    const result = await approvePrice(fd);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approved" ? "Price approved. The car is now listed." : "Revision requested.");
    router.refresh();
  }

  return (
    <div className="flex shrink-0 gap-2">
      <RejectReasonDialog
        trigger={
          <Button variant="outline" size="sm">
            Request Revision
          </Button>
        }
        title="Request a price revision?"
        description="The pricing goes back to the Marketing Specialist with your reason."
        label="What should change?"
        placeholder="For example: price is above market for this mileage."
        confirmLabel="Request Revision"
        onConfirm={(reason) => decide("rejected", reason)}
      />
      <ConfirmDialog
        action="approve"
        description={`The car goes live in the showroom at ₱${amount.toLocaleString()}.`}
        trigger={<Button size="sm">Approve</Button>}
        onConfirm={() => decide("approved")}
      />
    </div>
  );
}
