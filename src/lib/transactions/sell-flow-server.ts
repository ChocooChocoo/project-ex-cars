// Server-side building blocks for the Selling Scenario. Deliberately not a "use server" module:
// every export here writes with the service role and must only run behind a role-guarded action.

import { notify } from "@/lib/notifications/notify";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { FlowStatus, TransactionFlag, TransactionState } from "@/lib/transactions/state-machine";

type Admin = ReturnType<typeof createAdminClient>;

export interface SellTransaction {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  current_state: TransactionState;
  flag: TransactionFlag | null;
  sell: Record<string, unknown> | null;
}

export async function loadSellTransaction(admin: Admin, id: string): Promise<SellTransaction | null> {
  const { data } = await admin
    .from("transactions")
    .select("id, customer_id, vehicle_id, current_state, flag, transaction_kind, sell_details(*)")
    .eq("id", id)
    .maybeSingle();
  if (data?.transaction_kind !== "sell") return null;
  const sell = Array.isArray(data.sell_details) ? (data.sell_details[0] ?? null) : (data.sell_details ?? null);
  return {
    id: data.id,
    customer_id: data.customer_id,
    vehicle_id: data.vehicle_id,
    current_state: data.current_state,
    flag: data.flag,
    sell,
  };
}

// Moves a sell transaction and records the step in its status history.
export async function moveSellTransaction(
  admin: Admin,
  tx: SellTransaction,
  actorId: string,
  patch: {
    current_state?: TransactionState;
    flow_status?: FlowStatus | null;
    flag?: TransactionFlag | null;
    review_due_at?: string | null;
  },
  reason: string,
): Promise<string | null> {
  const toState = patch.current_state ?? tx.current_state;
  const ends = ["rejected", "cancelled", "completed"].includes(toState);
  const { error } = await admin
    .from("transactions")
    .update({
      ...patch,
      // An ended transaction has no open review window or process status left.
      ...(ends ? { completed_at: new Date().toISOString(), flow_status: null, review_due_at: null } : {}),
    })
    .eq("id", tx.id);
  if (error) return error.message;

  await admin.from("transaction_status_history").insert({
    transaction_id: tx.id,
    from_state: tx.current_state,
    to_state: toState,
    actor_id: actorId,
    reason,
  });
  return null;
}

// Selling steps 4 and 8: the CEO decides a purchase or revised ceiling. The car is not GCE's yet,
// so this never touches the vehicle's listing state or price (D3).
export async function applyCeilingDecision(
  admin: Admin,
  proposal: { proposal_kind: string; transaction_id: string; proposed_amount: number },
  decision: "approved" | "rejected",
  actorId: string,
): Promise<string | null> {
  const tx = await loadSellTransaction(admin, proposal.transaction_id);
  if (!tx) return "Sell transaction not found.";
  if (tx.current_state !== "under_review") return "This sell offer is not waiting for a ceiling decision.";

  const revised = proposal.proposal_kind === "revised_ceiling";
  const amount = `₱${Number(proposal.proposed_amount).toLocaleString()}`;
  const error = await moveSellTransaction(
    admin,
    tx,
    actorId,
    decision === "approved"
      ? { current_state: "approved", flow_status: null, review_due_at: null }
      : { current_state: "rejected" },
    `${revised ? "Revised" : "Purchase"} ceiling of ${amount} ${decision} by the CEO`,
  );
  if (error) return error;

  await notify(
    admin,
    { role: "marketing_specialist" },
    {
      kind: `ceiling_${decision}`,
      title: `${revised ? "Revised" : "Purchase"} ceiling ${decision}`,
      body:
        decision === "approved"
          ? revised
            ? `The CEO approved the revised ceiling of ${amount}. Have the Mechanic discuss it with the seller, then record the seller's answer.`
            : `The CEO approved a ceiling of ${amount}. Negotiate with the seller in the chat, within the ceiling.`
          : `The CEO rejected the ${revised ? "revised " : ""}ceiling of ${amount}. The sell offer has ended.`,
      transactionId: tx.id,
    },
  );
  if (decision === "rejected" || !revised) {
    await notify(
      admin,
      { userId: tx.customer_id },
      {
        kind: `sell_offer_${decision}`,
        title: decision === "approved" ? "GCE is ready to negotiate" : "GCE will not buy your vehicle",
        body:
          decision === "approved"
            ? "A GCE Marketing Specialist will contact you in the chat to agree on a price."
            : "After review, GCE will not proceed with your vehicle offer.",
        transactionId: tx.id,
      },
    );
  }
  return null;
}
