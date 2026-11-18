<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\Trading\BuyRules;
use App\Services\Trading\SellFlow;
use App\Services\Trading\Trading;
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
            'mechanic_id' => ['required', 'uuid'], 'schedule' => ['required', 'string'], 'location' => ['required', 'string', 'max:500'],
        ], [
            'agreed_price.*' => 'Enter an amount above zero.', 'mechanic_id.*' => 'Choose the Mechanic who inspects the car.',
            'schedule.*' => 'Set the meet-up date and time.', 'location.*' => 'Set the meet-up location.', '*' => 'Invalid agreement.',
        ]);
        $schedule = Trading::parseTime($data['schedule']);
        abort_unless($schedule, 422, 'Set a valid meet-up date and time.');
        $location = trim($data['location']);
        abort_if($location === '', 422, 'Set the meet-up location.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $schedule, $location, $actorId) {
            $tx = SellFlow::lock($data['transaction_id']);
            abort_unless($tx?->vehicle_id, 404, 'Sell transaction not found.');
            abort_if($tx->current_state !== 'approved', 409, 'Agree a price only after the CEO approves the ceiling.');
            abort_if(DB::table('field_cases')->where('transaction_id', $tx->id)->where('case_kind', 'acquisition')->exists(), 409, 'A field case already exists for this offer.');
            $ceiling = SellFlow::approvedCeiling(DB::table('vehicle_price_proposals')->where('transaction_id', $tx->id)->get(['proposal_kind', 'decision', 'proposed_amount', 'created_at']));
            abort_if($ceiling === null, 422, 'No approved ceiling for this offer.');
            abort_if((float) $data['agreed_price'] > $ceiling, 422, 'The agreed price must stay within the approved ceiling of '.self::peso($ceiling).'.');
            $method = $tx->sell?->meetup_method;
            $informant = $method === 'gce_visit' ? null : (($data['informant_id'] ?? null) ?: null);
            if ($method !== 'gce_visit') {
                abort_unless($informant, 422, 'Choose a Confidential Informant for the Meet Halfway.');
                abort_unless(Trading::isWorker($informant, 'confidential_informant'), 422, 'The selected user is not an active Confidential Informant.');
            }
            abort_unless(Trading::isWorker($data['mechanic_id'], 'mechanic'), 422, 'The selected user is not an active mechanic.');
            DB::table('sell_details')->where('transaction_id', $tx->id)->update(['agreed_price' => $data['agreed_price'], 'updated_at' => now()]);
            $caseId = (string) Str::uuid();
            DB::table('field_cases')->insert([
                'id' => $caseId, 'transaction_id' => $tx->id, 'vehicle_id' => $tx->vehicle_id, 'case_kind' => 'acquisition',
                'assigned_confidential_informant' => $informant, 'mechanic_id' => $data['mechanic_id'], 'schedule' => $schedule, 'location' => $location, 'state' => 'assigned',
                'notes' => 'Seller meet-up ('.(SellFlow::MEETUP_LABELS[$method] ?? 'method not set').'). Agreed price '.self::peso($data['agreed_price']).'.',
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

    /** createInspectionIssueReport (selling step 7). One report per inspection (database key). */
    public function createInspectionIssueReport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'is_profitable' => ['required', 'in:yes,no'], 'profitability_reason' => ['required', 'string', 'max:2000'],
            'recalculated_price' => ['nullable', 'numeric', 'gt:0'], 'new_ceiling' => ['nullable', 'numeric', 'gt:0'], 'seller_remarks' => ['nullable', 'string', 'max:1000'],
        ], ['profitability_reason.required' => 'Explain the profitability decision.', '*' => 'Invalid report.']);
        $reason = trim($data['profitability_reason']);
        abort_if($reason === '', 422, 'Explain the profitability decision.');
        $profitable = $data['is_profitable'] === 'yes';
        $recalculated = ($data['recalculated_price'] ?? null) ? (float) $data['recalculated_price'] : null;
        $ceiling = ($data['new_ceiling'] ?? null) ? (float) $data['new_ceiling'] : null;
        $remarks = trim((string) ($data['seller_remarks'] ?? ''));
        abort_if($profitable && (! $recalculated || ! $ceiling), 422, 'A profitable vehicle needs a recalculated price and a new ceiling.');
        abort_if($profitable && $remarks === '', 422, 'Write remarks for the seller explaining the new price.');
        abort_if($profitable && $recalculated > $ceiling, 422, 'The recalculated price cannot exceed the new ceiling.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $reason, $profitable, $recalculated, $ceiling, $remarks, $actorId) {
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
                    'proposer_id' => $actorId, 'decision' => 'pending', 'notes' => "Inspection issue: {$case->issue_description}. Recalculated price ".self::peso($recalculated).'.', 'created_at' => now(),
                ]);
            }
            DB::table('inspection_issue_reports')->insert([
                'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'field_case_id' => $case->id, 'issue_found' => $case->issue_description,
                'repair_estimate' => $case->repair_estimate, 'is_profitable' => $profitable, 'profitability_reason' => $reason,
                'seller_remarks' => $profitable ? $remarks : null, 'recalculated_price' => $recalculated, 'new_ceiling' => $ceiling,
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

    /** recordSellerResponse (selling step 9). */
    public function recordSellerResponse(Request $request): JsonResponse
    {
        $data = $request->validate(['transaction_id' => ['required', 'uuid'], 'response' => ['required', 'in:agreed,refused']], ['*' => 'Invalid seller response.']);
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $actorId) {
            $tx = SellFlow::lock($data['transaction_id']);
            abort_unless($tx, 404, 'Sell transaction not found.');
            abort_if($tx->current_state !== 'approved', 409, 'The CEO has not approved a revised price for this offer.');
            $report = DB::table('inspection_issue_reports as r')->leftJoin('vehicle_price_proposals as p', 'p.id', '=', 'r.proposal_id')
                ->where('r.transaction_id', $tx->id)->where('r.is_profitable', true)->lockForUpdate()
                ->first(['r.id', 'r.recalculated_price', 'r.seller_response', 'p.decision']);
            abort_if(! $report || $report->decision !== 'approved', 422, 'No approved revised price to present.');
            abort_if((bool) $report->seller_response, 409, "The seller's answer is already recorded.");
            DB::table('inspection_issue_reports')->where('id', $report->id)->update(['seller_response' => $data['response'], 'seller_response_at' => now()]);
            if ($data['response'] === 'agreed') {
                DB::table('sell_details')->where('transaction_id', $tx->id)->update(['agreed_price' => $report->recalculated_price, 'cleared_for_payment_at' => now(), 'updated_at' => now()]);
                Trading::history($tx->id, $tx->current_state, $tx->current_state, $actorId, 'Seller agreed to the revised price of '.self::peso($report->recalculated_price).'; cleared for payment');
                foreach (['account_manager', 'ceo'] as $role) {
                    Trading::notify(['role' => $role], 'sell_ready_for_payment', "Seller's car cleared for payment",
                        'The seller agreed to '.self::peso($report->recalculated_price).'. Pay the seller from the released funds and return the excess.', $tx->id);
                }

                return;
            }
            SellFlow::move($tx, $actorId, ['current_state' => 'cancelled', 'flag' => 'seller_refused'], 'Seller refused the revised price');
        });

        return response()->json(['success' => true]);
    }
}
