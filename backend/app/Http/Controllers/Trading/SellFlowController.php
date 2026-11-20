<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\Finance\Money;
use App\Services\Trading\BuyRules;
use App\Services\Trading\SellFlow;
use App\Services\Trading\Trading;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Marketing Specialist sell-offer steps (was src/app/(staff)/transactions/sell-actions.ts). Route group: marketing_specialist. */
class SellFlowController extends Controller
{
    private static function peso(mixed $amount): string
    {
        return '₱'.number_format((float) $amount, fmod((float) $amount, 1.0) === 0.0 ? 0 : 2);
    }

    /**
     * SH-12 / SH-14: the field case location comes from the seller's own meet-up pin, never from a free-text input:
     * the composed address when the reverse geocoder filled one, else the coordinates.
     */
    private static function meetupLocation(?object $sell): string
    {
        $address = trim((string) ($sell?->meetup_address ?? ''));
        if ($address !== '') {
            return $address;
        }
        if ($sell?->meetup_lat !== null && $sell?->meetup_lng !== null) {
            return number_format((float) $sell->meetup_lat, 5, '.', '').', '.number_format((float) $sell->meetup_lng, 5, '.', '');
        }

        return '';
    }

    /** flagSellSubmission (selling step 2): a failed check rejects the offer. */
    public function flagSellSubmission(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'outcome' => ['required', 'in:reject'], 'reason' => ['required', 'string', 'max:1000'],
        ], ['outcome.*' => 'Only rejecting is available.', 'reason.required' => 'Give the reason.', '*' => 'Invalid request.']);
        $reason = trim($data['reason']);
        abort_if($reason === '', 422, 'Give the reason.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $reason, $actorId) {
            $tx = SellFlow::lock($data['transaction_id']);
            abort_unless($tx, 404, 'Sell transaction not found.');
            abort_if($tx->current_state !== 'pending', 409, 'Only a submitted offer awaiting verification can be rejected.');
            SellFlow::move($tx, $actorId, ['current_state' => 'rejected'], "Rejected at verification: {$reason}");
            Trading::notify(['userId' => $tx->customer_id], 'sell_offer_rejected', 'Your vehicle offer was rejected', $reason, $tx->id);
            Trading::audit($actorId, 'sell_rejected', 'transactions', $tx->id, "Sell offer {$tx->id} rejected at verification");
        });

        return response()->json(['success' => true]);
    }

    /** proposePurchaseCeiling (selling step 3): one pending ceiling per car (database key). */
    public function proposePurchaseCeiling(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'amount' => ['required', 'numeric', 'gt:0'], 'notes' => ['nullable', 'string', 'max:1000'],
        ], ['amount.*' => 'Enter an amount above zero.', '*' => 'Invalid proposal.']);
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $actorId) {
            $tx = SellFlow::lock($data['transaction_id']);
            abort_unless($tx?->vehicle_id, 404, 'Sell transaction not found.');
            abort_if($tx->current_state !== 'pending', 409, 'A ceiling can only be proposed for a submitted offer.');
            abort_unless(SellFlow::papersVerified(DB::table('transaction_documents')->where('transaction_id', $tx->id)->get(['document_kind', 'verification_state', 'id_type', 'id_side'])), 422,
                'Verify both valid IDs (front and back), the OR, the CR and the deed of sale before proposing a ceiling.');
            DB::table('vehicle_price_proposals')->insert([
                'id' => (string) Str::uuid(), 'vehicle_id' => $tx->vehicle_id, 'transaction_id' => $tx->id, 'proposal_kind' => 'purchase_ceiling',
                'proposed_amount' => $data['amount'], 'proposer_id' => $actorId, 'decision' => 'pending', 'notes' => trim((string) ($data['notes'] ?? '')) ?: null, 'created_at' => now(),
            ]);
            SellFlow::move($tx, $actorId, ['current_state' => 'under_review', 'flow_status' => 'pending_ceo_approval', 'review_due_at' => BuyRules::reviewDueAt(), 'flag' => null],
                'Purchase ceiling of '.self::peso($data['amount']).' proposed to the CEO');
            Trading::notify(['role' => 'ceo'], 'ceiling_proposed', 'Purchase ceiling awaiting approval', 'A purchase ceiling of '.self::peso($data['amount']).' awaits your decision within 7 days.', $tx->id);
            Trading::notify(['userId' => $tx->customer_id], 'sell_offer_in_review', 'Your vehicle offer is being reviewed', 'GCE has verified your papers. Expect a response within 5–7 days.', $tx->id);
        });

        return response()->json(['success' => true]);
    }

    /** recordAgreedPrice (selling step 5): the price within the ceiling, and the acquisition field case. */
    public function recordAgreedPrice(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'agreed_price' => ['required', 'numeric', 'gt:0'], 'informant_id' => ['nullable', 'uuid'],
            'mechanic_id' => ['required', 'uuid'], 'schedule' => ['required', 'string'],
        ], [
            'agreed_price.*' => 'Enter an amount above zero.', 'mechanic_id.*' => 'Choose the Mechanic who inspects the car.',
            'schedule.*' => 'Set the meet-up date and time.', '*' => 'Invalid agreement.',
        ]);
        $schedule = Trading::parseTime($data['schedule']);
        abort_unless($schedule, 422, 'Set a valid meet-up date and time.');
        // SH-12: a schedule that already passed would send the field team nowhere.
        abort_if($schedule->lessThanOrEqualTo(CarbonImmutable::now()), 422, 'Set a future meet-up date and time.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $schedule, $actorId) {
            $tx = SellFlow::lock($data['transaction_id']);
            abort_unless($tx?->vehicle_id, 404, 'Sell transaction not found.');
            abort_if($tx->current_state !== 'approved', 409, 'Agree a price only after the CEO approves the ceiling.');
            abort_if(DB::table('field_cases')->where('transaction_id', $tx->id)->where('case_kind', 'acquisition')->exists(), 409, 'A field case already exists for this offer.');
            $ceiling = SellFlow::approvedCeiling(DB::table('vehicle_price_proposals')->where('transaction_id', $tx->id)->get(['proposal_kind', 'decision', 'proposed_amount', 'created_at']));
            abort_if($ceiling === null, 422, 'No approved ceiling for this offer.');
            abort_if((float) $data['agreed_price'] > $ceiling, 422, 'The agreed price must stay within the approved ceiling of '.self::peso($ceiling).'.');
            $method = $tx->sell?->meetup_method;
            // BH-1: a Meet Halfway trip is booked at least 2 Manila calendar days ahead, as the buyer side is.
            abort_if($method === 'meet_halfway' && ! BuyRules::isMeetupDate($schedule), 422, BuyRules::MEETUP_LEAD_MESSAGE);
            // SH-12 / SH-14: the Marketing Specialist no longer types the location. A Meet Halfway case reads the
            // seller's own pin and address; a GCE visit happens at GCE.
            $location = $method === 'gce_visit' ? 'GCE' : self::meetupLocation($tx->sell);
            abort_if($location === '', 422, 'The seller has not set a meet-up point yet. Ask them to set it on the map.');
            $informant = $method === 'gce_visit' ? null : (($data['informant_id'] ?? null) ?: null);
            if ($method !== 'gce_visit') {
                abort_unless($informant, 422, 'Choose a Confidential Informant for the Meet Halfway.');
                abort_unless(Trading::isWorker($informant, 'confidential_informant'), 422, 'The selected user is not an active Confidential Informant.');
            }
            abort_unless(Trading::isWorker($data['mechanic_id'], 'mechanic'), 422, 'The selected user is not an active mechanic.');
            DB::table('sell_details')->where('transaction_id', $tx->id)->update(['agreed_price' => $data['agreed_price'], 'updated_at' => now()]);
            $caseId = (string) Str::uuid();
            // SN-7: the case notes name the real arrangement, reading exactly like the field-case header's
            // arrangementLabel (sell-meetup-case.tsx), so a GCE visit is never called a seller meet-up.
            $arrangement = SellFlow::ARRANGEMENT_LABELS[$method] ?? 'Seller meet-up';
            DB::table('field_cases')->insert([
                'id' => $caseId, 'transaction_id' => $tx->id, 'vehicle_id' => $tx->vehicle_id, 'case_kind' => 'acquisition',
                'assigned_confidential_informant' => $informant, 'mechanic_id' => $data['mechanic_id'], 'schedule' => $schedule, 'location' => $location, 'state' => 'assigned',
                'notes' => $arrangement.'. Agreed price '.self::peso($data['agreed_price']).'.',
                'created_at' => now(), 'updated_at' => now(),
            ]);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $actorId, 'Price agreed at '.self::peso($data['agreed_price']).'; acquisition field case created');
            foreach (array_filter([$informant, $data['mechanic_id']]) as $worker) {
                Trading::notify(['userId' => $worker], 'field_case_assigned', 'New seller meet-up', "Inspect a seller's car on ".Trading::when($schedule)." at {$location}.", $tx->id);
            }
            Trading::audit($actorId, 'field_case_created_acquisition', 'field_cases', $caseId, "Acquisition field case created for sell offer {$tx->id}");
        });

        return response()->json(['success' => true]);
    }

    /**
     * createInspectionIssueReport (selling step 7). One report per inspection (database key). SH-6: the report
     * carries no recalculated price any more — the approved revised ceiling is a maximum, and the real price is
     * agreed with the seller in the second negotiation (recordSellerResponse).
     */
    public function createInspectionIssueReport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'is_profitable' => ['required', 'in:yes,no'], 'profitability_reason' => ['required', 'string', 'max:2000'],
            'new_ceiling' => ['nullable', 'numeric', 'gt:0'], 'seller_remarks' => ['nullable', 'string', 'max:1000'],
        ], ['profitability_reason.required' => 'Explain the profitability decision.', '*' => 'Invalid report.']);
        $reason = trim($data['profitability_reason']);
        abort_if($reason === '', 422, 'Explain the profitability decision.');
        $profitable = $data['is_profitable'] === 'yes';
        $ceiling = ($data['new_ceiling'] ?? null) ? (float) $data['new_ceiling'] : null;
        $remarks = trim((string) ($data['seller_remarks'] ?? ''));
        abort_if($profitable && ! $ceiling, 422, 'A profitable vehicle needs a new ceiling.');
        abort_if($profitable && $remarks === '', 422, 'Write remarks for the seller explaining the reduction.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $reason, $profitable, $ceiling, $remarks, $actorId) {
            $tx = SellFlow::lock($data['transaction_id']);
            abort_unless($tx?->vehicle_id, 404, 'Sell transaction not found.');
            abort_if($tx->current_state !== 'approved', 409, 'This offer is not waiting for an inspection report.');
            $case = DB::table('field_cases')->where('transaction_id', $tx->id)->where('case_kind', 'acquisition')->lockForUpdate()->first();
            abort_if($case?->inspection_outcome !== 'issue_found', 422, 'The field team has not reported an issue.');
            abort_if(DB::table('inspection_issue_reports')->where('field_case_id', $case->id)->exists(), 409, 'An Inspection Issue Report already exists for this inspection.');
            $proposalId = null;
            if ($profitable) {
                $proposalId = (string) Str::uuid();
                DB::table('vehicle_price_proposals')->insert([
                    'id' => $proposalId, 'vehicle_id' => $tx->vehicle_id, 'transaction_id' => $tx->id, 'proposal_kind' => 'revised_ceiling', 'proposed_amount' => $ceiling,
                    'proposer_id' => $actorId, 'decision' => 'pending', 'notes' => "Inspection issue: {$case->issue_description}. Revised ceiling ".self::peso($ceiling).'.', 'created_at' => now(),
                ]);
            }
            DB::table('inspection_issue_reports')->insert([
                'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'field_case_id' => $case->id, 'issue_found' => $case->issue_description,
                'repair_estimate' => $case->repair_estimate, 'is_profitable' => $profitable, 'profitability_reason' => $reason,
                // SH-6: no recalculated price is collected any more. The column stays for rows written before this
                // change; nothing copies it into the agreed price.
                'seller_remarks' => $profitable ? $remarks : null, 'recalculated_price' => null, 'new_ceiling' => $ceiling,
                'proposal_id' => $proposalId, 'created_by' => $actorId, 'created_at' => now(),
            ]);
            SellFlow::move($tx, $actorId, $profitable
                ? ['current_state' => 'under_review', 'flow_status' => 'pending_ceo_approval', 'review_due_at' => BuyRules::reviewDueAt()]
                : ['current_state' => 'cancelled', 'flag' => 'cancelled_unprofitable'], $profitable
                ? 'Revised ceiling of '.self::peso($ceiling).' sent to the CEO after an inspection issue'
                : "Cancelled: not profitable after inspection. {$reason}");
            if ($profitable) {
                Trading::notify(['role' => 'ceo'], 'ceiling_proposed', 'Revised ceiling awaiting approval', 'An inspection found an issue. A revised ceiling of '.self::peso($ceiling).' awaits your decision.', $tx->id);
            } else {
                foreach (array_filter([$tx->customer_id, $case->assigned_confidential_informant, $case->mechanic_id]) as $recipient) {
                    Trading::notify(['userId' => $recipient], 'sell_offer_cancelled', 'GCE will no longer buy this vehicle', 'After the inspection, GCE will not proceed with the purchase.', $tx->id);
                }
            }
        });

        return response()->json(['success' => true]);
    }

    /**
     * recordSellerResponse (selling step 9). SH-6: the CEO-approved revised ceiling is a MAXIMUM, so the Marketing
     * Specialist renegotiates and records the price the seller actually accepted. It must stay under the approved
     * ceiling, and it — not the ceiling — becomes `sell_details.agreed_price`.
     */
    public function recordSellerResponse(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'response' => ['required', 'in:agreed,refused'], 'agreed_price' => ['nullable', 'numeric', 'gt:0'],
        ], ['agreed_price.gt' => 'Enter the agreed price.', '*' => 'Invalid seller response.']);
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $actorId) {
            $tx = SellFlow::lock($data['transaction_id']);
            abort_unless($tx, 404, 'Sell transaction not found.');
            abort_if($tx->current_state !== 'approved', 409, 'The CEO has not approved a revised price for this offer.');
            $report = DB::table('inspection_issue_reports as r')->leftJoin('vehicle_price_proposals as p', 'p.id', '=', 'r.proposal_id')
                ->where('r.transaction_id', $tx->id)->where('r.is_profitable', true)->lockForUpdate()
                ->first(['r.id', 'r.seller_response', 'p.decision']);
            abort_if(! $report || $report->decision !== 'approved', 422, 'No approved revised price to present.');
            abort_if((bool) $report->seller_response, 409, "The seller's answer is already recorded.");
            $agreed = $data['response'] === 'agreed' ? ($data['agreed_price'] ?? null) : null;
            if ($data['response'] === 'agreed') {
                abort_unless($agreed !== null, 422, 'Enter the agreed price.');
                $ceiling = SellFlow::approvedCeiling(DB::table('vehicle_price_proposals')->where('transaction_id', $tx->id)
                    ->get(['proposal_kind', 'decision', 'proposed_amount', 'created_at']));
                abort_if($ceiling === null, 422, 'No approved ceiling for this offer.');
                // Compare in centavos, never as formatted strings or raw floats.
                abort_if(Money::cents($agreed) > Money::cents($ceiling), 422, 'The agreed price cannot exceed the approved ceiling of '.self::peso($ceiling).'.');
            }
            DB::table('inspection_issue_reports')->where('id', $report->id)->update(['seller_response' => $data['response'], 'seller_response_at' => now()]);
            if ($data['response'] === 'agreed') {
                DB::table('sell_details')->where('transaction_id', $tx->id)->update(['agreed_price' => $agreed, 'cleared_for_payment_at' => now(), 'updated_at' => now()]);
                Trading::history($tx->id, $tx->current_state, $tx->current_state, $actorId, 'Seller agreed to the negotiated price of '.self::peso($agreed).'; cleared for payment');
                foreach (['account_manager', 'ceo'] as $role) {
                    Trading::notify(['role' => $role], 'sell_ready_for_payment', "Seller's car cleared for payment",
                        'The seller agreed to '.self::peso($agreed).'. Pay the seller from the released funds and return the excess.', $tx->id);
                }

                return;
            }
            SellFlow::move($tx, $actorId, ['current_state' => 'cancelled', 'flag' => 'seller_refused'], 'Seller refused the revised offer');
        });

        return response()->json(['success' => true]);
    }
}
