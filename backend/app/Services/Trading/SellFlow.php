<?php

namespace App\Services\Trading;

use Illuminate\Support\Facades\DB;

/** Selling Scenario building blocks (was src/lib/transactions/sell-flow-server.ts). Call inside Trading::run(). */
final class SellFlow
{
    public const MEETUP_LABELS = ['meet_halfway' => 'Meet Halfway within Calabarzon', 'gce_visit' => 'GCE Visit'];

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

    /** Selling steps 4 and 8: the CEO decides a purchase or revised ceiling. The vehicle is untouched (D3). */
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
            ? ($revised ? "The CEO approved the revised ceiling of {$amount}. Have the Mechanic discuss it with the seller, then record the seller's answer."
                : "The CEO approved a ceiling of {$amount}. Negotiate with the seller in the chat, within the ceiling.")
            : 'The CEO rejected the '.($revised ? 'revised ' : '')."ceiling of {$amount}. The sell offer has ended.", $tx->id);
        if ($decision === 'rejected' || ! $revised) {
            Trading::notify(['userId' => $tx->customer_id], "sell_offer_{$decision}",
                $decision === 'approved' ? 'GCE is ready to negotiate' : 'GCE will not buy your vehicle',
                $decision === 'approved' ? 'A GCE Marketing Specialist will contact you in the chat to agree on a price.' : 'After review, GCE will not proceed with your vehicle offer.', $tx->id);
        }
    }

    /** sell-flow.ts sellPapersVerified. */
    public static function papersVerified(iterable $documents): bool
    {
        $verified = collect($documents)->where('verification_state', 'verified');
        $count = fn (string $kind) => $verified->where('document_kind', $kind)->count();
        $orAndCr = $count('orcr') >= 1 || ($count('official_receipt') >= 1 && $count('certificate_of_registration') >= 1);

        return BuyRules::buyerIdsComplete($verified->all()) && $orAndCr && $count('deed_of_sale') >= 1;
    }

    /** sell-flow.ts approvedCeiling: the newest approved ceiling proposal's amount. */
    public static function approvedCeiling(iterable $proposals): ?float
    {
        $p = collect($proposals)->filter(fn ($p) => $p->decision === 'approved' && in_array($p->proposal_kind, ['purchase_ceiling', 'revised_ceiling'], true))
            ->sortByDesc(fn ($p) => (string) $p->created_at)->first();

        return $p ? (float) $p->proposed_amount : null;
    }
}
