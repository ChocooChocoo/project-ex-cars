<?php

namespace App\Services\Trading;

use Illuminate\Support\Facades\DB;

/** Selling Scenario building blocks (was src/lib/transactions/sell-flow-server.ts). Call inside Trading::run(). */
final class SellFlow
{
    /** SH-2 / SN-7: the seller's meet-up method, worded as the customer form offers it (MEETUP_METHOD_LABELS). */
    public const MEETUP_LABELS = ['meet_halfway' => 'Meet Halfway within Calabarzon', 'gce_visit' => 'GCE Visit'];

    /**
     * SN-7: the arrangement as the field-case header names it (sell-meetup-case.tsx arrangementLabel), used for the
     * acquisition case notes so a GCE visit is never described as a seller meet-up.
     */
    public const ARRANGEMENT_LABELS = ['gce_visit' => 'GCE visit', 'meet_halfway' => 'Seller meet-up (Meet Halfway)'];

    /** A sell transaction locked for this step, with its sell_details as ->sell, or null. */
    public static function lock(mixed $id): ?object
    {
        if (! is_string($id) || ! \Illuminate\Support\Str::isUuid($id)) {
            return null;
        }
        $tx = Trading::lockTx($id);
        if (! $tx || $tx->transaction_kind !== 'sell') {
            return null;
        }
        $tx->sell = DB::table('sell_details')->where('transaction_id', $id)->lockForUpdate()->first();

        return $tx;
    }

    /**
     * Moves a sell transaction and records the step. An offer that ends unpaid asks every holder of released
     * funds to return them. The expected current state guards the update, so a repeat finds a conflict.
     */
    public static function move(object $tx, string $actorId, array $patch, string $reason): void
    {
        $to = $patch['current_state'] ?? $tx->current_state;
        if (in_array($to, Trading::TERMINAL, true)) {
            $patch += ['completed_at' => now()];
            $patch['flow_status'] = null;
            $patch['review_due_at'] = null;
        }
        abort_unless(Trading::updateTx($tx->id, $patch, $tx->current_state), 409, 'This offer has already moved. Refresh the page.');
        Trading::history($tx->id, $tx->current_state, $to, $actorId, $reason);
        if (in_array($to, ['rejected', 'cancelled'], true)) {
            $funds = DB::table('disbursement_requests')->where('purchase_transaction_id', $tx->id)
                ->whereIn('status', ['released', 'received'])->whereNull('returned_at')->get(['requested_by', 'amount_cents']);
            foreach ($funds as $fund) {
                Trading::notify(['userId' => $fund->requested_by], 'purchase_funds_return', 'Return the released funds',
                    "The seller's offer ended without a purchase. Return the ₱".Trading::peso($fund->amount_cents / 100).' released to you and record it on the field case.', $tx->id);
            }
        }
        $tx->current_state = $to;
    }

    /**
     * Selling steps 4 and 8: the CEO decides a purchase or revised ceiling. The vehicle is untouched (D3).
     *
     * SH-6: a revised ceiling is a MAXIMUM, not the price, so approving one never sets an agreed price. The seller
     * is told about the reduction and that the Marketing Specialist will discuss an offer in the chat — never the
     * ceiling amount, which is internal.
     */
    public static function applyCeilingDecision(object $proposal, string $decision, string $actorId): void
    {
        $tx = self::lock($proposal->transaction_id);
        abort_unless($tx, 404, 'Sell transaction not found.');
        abort_if($tx->current_state !== 'under_review', 409, 'This sell offer is not waiting for a ceiling decision.');
        $revised = $proposal->proposal_kind === 'revised_ceiling';
        $amount = '₱'.number_format((float) $proposal->proposed_amount);
        self::move($tx, $actorId, $decision === 'approved' ? ['current_state' => 'approved', 'flow_status' => null, 'review_due_at' => null] : ['current_state' => 'rejected'],
            ($revised ? 'Revised' : 'Purchase')." ceiling of {$amount} {$decision} by the CEO");
        Trading::notify(['role' => 'marketing_specialist'], "ceiling_{$decision}", ($revised ? 'Revised' : 'Purchase')." ceiling {$decision}", $decision === 'approved'
            ? ($revised ? "The CEO approved the revised ceiling of {$amount}. Negotiate the final price with the seller in the chat, then record the seller's answer."
                : "The CEO approved a ceiling of {$amount}. Negotiate with the seller in the chat, within the ceiling.")
            : 'The CEO rejected the '.($revised ? 'revised ' : '')."ceiling of {$amount}. The sell offer has ended.", $tx->id);
        if ($decision === 'rejected') {
            Trading::notify(['userId' => $tx->customer_id], "sell_offer_{$decision}", 'GCE will not buy your vehicle',
                'After review, GCE will not proceed with your vehicle offer.', $tx->id);
        } elseif ($revised) {
            // SH-6: the seller learns that the price changed and why, never the ceiling it must stay under.
            Trading::notify(['userId' => $tx->customer_id], 'sell_offer_approved', 'A revised offer is coming',
                'GCE found issues during inspection; the Marketing Specialist will discuss a revised offer in the chat.', $tx->id);
        } else {
            Trading::notify(['userId' => $tx->customer_id], 'sell_offer_approved', 'GCE is ready to negotiate',
                'A GCE Marketing Specialist will contact you in the chat to agree on a price.', $tx->id);
        }
    }

    /**
     * sell-flow.ts sellPapersVerified (SN-11): only the two valid IDs, front and back, must be verified before a
     * ceiling is proposed. The OR, the CR and the deed of sale are declared on the seller's checklist and checked
     * against the originals on site, so offers that still carry them are not blocked either.
     */
    public static function papersVerified(iterable $documents): bool
    {
        $verified = collect($documents)->where('verification_state', 'verified');

        return BuyRules::buyerIdsComplete($verified->all());
    }

    /**
     * sell-flow.ts approvedCeiling: the newest approved ceiling proposal's amount. A purchase ceiling and a revised
     * ceiling are both ceilings, and a revision supersedes the purchase ceiling it replaced — so it wins even when
     * both rows carry the same timestamp (two proposals in one second, as tests and fast hand-offs produce).
     */
    public static function approvedCeiling(iterable $proposals): ?float
    {
        $p = collect($proposals)->filter(fn ($p) => $p->decision === 'approved' && in_array($p->proposal_kind, ['purchase_ceiling', 'revised_ceiling'], true))
            // Sort on a comparable tuple: newest first, then a revised ceiling over the purchase ceiling it
            // replaced, then the id so the result never depends on the unordered rows MySQL happened to return.
            ->sortByDesc(fn ($p) => [(string) $p->created_at, $p->proposal_kind === 'revised_ceiling' ? 1 : 0, (string) ($p->id ?? '')])
            ->first();

        return $p ? (float) $p->proposed_amount : null;
    }

    /** The history reasons the seller may read (sell-flow.ts SELLER_NOTE_PREFIXES); everything else is internal. */
    private const SELLER_NOTE_PREFIXES = ['Price agreed at', 'Seller agreed to the negotiated price', 'Seller agreed to the revised price', 'Sell transaction created'];

    private const VERIFICATION_REJECT = 'Rejected at verification: ';

    /**
     * sell-flow.ts sellerSafeNote, as the server-side gate on the seller's own payload. SH-6: a sell history reason
     * quotes the ceiling, the CEO's decision and the staff-only profitability note, so the server — not the page —
     * decides which reasons leave. A readable reason is returned verbatim: the page strips the
     * "Rejected at verification: " prefix when it renders, so this must not strip it or the page would then treat
     * the already-shortened text as internal and hide it.
     */
    public static function sellerVisibleReason(mixed $reason): ?string
    {
        if (! is_string($reason)) {
            return null;
        }
        if (str_starts_with($reason, self::VERIFICATION_REJECT)) {
            return $reason;
        }
        foreach (self::SELLER_NOTE_PREFIXES as $prefix) {
            if (str_starts_with($reason, $prefix)) {
                return $reason;
            }
        }

        return null;
    }
}
