<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Catalogue\ShowroomController;
use App\Http\Controllers\Controller;
use App\Services\Finance\Money;
use App\Services\Finance\Payments;
use App\Services\Finance\PaymentRules;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * In-House Financing terms (was src/app/(staff)/transactions/financing-terms-actions.ts): the Sales Manager
 * proposes, the CEO confirms (the Head Accountant's review stays for rows already in it), and the Head Accountant
 * completes the agreement, which opens the installment account. Amounts are integer centavos (Money).
 */
class FinancingTermsController extends Controller
{
    private function actor(Request $request, array $roles): string
    {
        abort_unless(in_array((string) $request->user()->role()?->value, $roles, true), 403, 'Not authorized for this financing step.');

        return $request->user()->id;
    }

    /** The financing request (loadFinancing), locked, with its details, car and terms. */
    private function load(mixed $id): ?object
    {
        if (! is_string($id) || ! Str::isUuid($id)) {
            return null;
        }
        $peek = DB::table('transactions')->where('id', $id)->first(['vehicle_id', 'transaction_kind']);
        if ($peek?->transaction_kind !== 'buy') {
            return null;
        }
        if ($peek->vehicle_id) {
            DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first();
        }
        $tx = Trading::lockTx($id);
        $tx->details = DB::table('purchase_details')->where('transaction_id', $id)->first();
        if (! BuyRules::isFinancingRequest($tx->details)) {
            return null;
        }
        $tx->terms = DB::table('payment_terms')->where('purchase_transaction_id', $id)->lockForUpdate()->first();
        $tx->vehicleMarkup = $peek->vehicle_id ? DB::table('vehicles')->where('id', $peek->vehicle_id)->value('financing_markup_pct') : null;

        return $tx;
    }

    private static function peso(int $cents): string
    {
        return '₱'.Money::peso($cents);
    }

    /** §6 steps 6–7 (T06: the buyer chose the term; the monthly payment follows from it). */
    public function propose(Request $request): JsonResponse
    {
        $actor = $this->actor($request, ['sales_manager', 'ceo']);
        $data = $request->validate([
            'total_amount' => ['nullable', 'numeric', 'gt:0'],
            'first_due_date' => ['required', 'string'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], ['total_amount.*' => 'Enter the vehicle price.', 'first_due_date.required' => 'Set the first due date.', '*' => 'Invalid terms.']);

        Trading::run(function () use ($request, $data, $actor) {
            $tx = $this->load($request->input('transaction_id'));
            abort_unless($tx, 404, 'Financing request not found.');
            abort_if($tx->terms && in_array($tx->terms->state, ['approved', 'active', 'completed'], true) && $data['first_due_date'] !== $tx->terms->first_due_date,
                422, 'The first due date cannot change after financing approval.');
            abort_unless($tx->current_state === 'approved', 422, 'Approve the request before proposing terms.');
            abort_if($tx->terms && $tx->terms->state !== 'returned', 409, 'Terms are already in review.');

            $price = Money::cents($tx->details->final_price);
            $markup = $tx->vehicleMarkup !== null && (float) $tx->vehicleMarkup >= 0 ? (float) $tx->vehicleMarkup : ShowroomController::globalMarkupPct();
            $total = ! empty($data['total_amount']) ? Money::cents($data['total_amount']) : PaymentRules::financedTotal($price, $markup);
            abort_unless($total > 0, 422, 'Enter the vehicle price.');
            $kind = $tx->details->arrangement_kind;
            $delivery = $kind === 'delivery';
            abort_if($delivery && trim((string) $request->input('delivery_fee')) === '', 422, 'Enter the delivery fee.');
            abort_if($kind !== 'meetup' && $price <= 0, 422, 'Set the vehicle price first.');
            $down = $kind === 'meetup' ? 0 : PaymentRules::downPayment($price);
            abort_if($down >= $total, 422, 'The Initial Downpayment must be below the vehicle price.');
            $months = (int) ($tx->details->requested_term_months ?? 0);
            abort_unless($months > 0, 422, 'The buyer has not chosen a payment term yet.');

            $row = [
                'arrangement_description' => trim((string) ($data['notes'] ?? '')) ?: "{$months}-month In-House Financing",
                'total_amount' => Money::decimal($total), 'down_payment' => Money::decimal($down),
                'monthly_payment' => Money::decimal(PaymentRules::monthlyInstallment($total, $down, $months)),
                'delivery_fee' => $delivery ? Money::decimal(Money::cents($data['delivery_fee'] ?? 0)) : null,
                'number_of_payments' => $months, 'duration_months' => $months, 'payment_frequency' => 'monthly', 'first_due_date' => $data['first_due_date'],
                'agreed_by' => $actor, 'state' => 'proposed', 'returned_reason' => null, 'ha_reviewed_by' => null, 'ha_reviewed_at' => null, 'updated_at' => now(),
            ];
            $tx->terms
                ? DB::table('payment_terms')->where('id', $tx->terms->id)->update($row)
                : DB::table('payment_terms')->insert($row + ['id' => (string) Str::uuid(), 'purchase_transaction_id' => $tx->id, 'created_at' => now()]);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $actor, "Financing proposed: {$months} months, downpayment ".self::peso($down));
            Trading::notify(['role' => 'ceo'], 'financing_terms_proposed', 'Financing terms to confirm',
                "{$months} months on ".self::peso($total).', Initial Downpayment '.self::peso($down).'. Confirm them so the buyer can decide.', $tx->id);
        });

        return response()->json(['success' => true]);
    }

    /** §6 step 8: the Head Accountant approves for the CEO or returns with a reason. */
    public function review(Request $request): JsonResponse
    {
        $actor = $this->actor($request, ['head_accountant']);
        $decision = $request->input('decision');
        $reason = trim((string) $request->input('reason'));
        abort_unless(in_array($decision, ['approve', 'return'], true) && mb_strlen($reason) <= 500, 422, 'Invalid review.');
        abort_if($decision === 'return' && $reason === '', 422, 'Say what needs to change.');

        Trading::run(function () use ($request, $actor, $decision, $reason) {
            $tx = $this->load($request->input('transaction_id'));
            abort_unless($tx?->terms?->state === 'proposed', 409, 'No proposed terms to review.');
            $approve = $decision === 'approve';
            DB::table('payment_terms')->where('id', $tx->terms->id)->update(($approve
                ? ['state' => 'ha_approved', 'ha_reviewed_by' => $actor, 'ha_reviewed_at' => now()]
                : ['state' => 'returned', 'returned_reason' => $reason]) + ['updated_at' => now()]);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $actor, $approve ? 'Head Accountant approved the financing terms' : "Terms returned: {$reason}");
            Trading::notify(['role' => $approve ? 'ceo' : 'sales_manager'], $approve ? 'financing_terms_reviewed' : 'financing_terms_returned',
                $approve ? 'Financing terms to confirm' : 'Financing terms returned', $approve ? 'The Head Accountant approved the financing terms.' : "Revise and resubmit: {$reason}", $tx->id);
        });

        return response()->json(['success' => true]);
    }

    /** §6 steps 9–10: the CEO confirms the terms (they become the buyer's offer) or returns them. */
    public function confirm(Request $request): JsonResponse
    {
        $actor = $this->actor($request, ['ceo']);
        $decision = $request->input('decision');
        $reason = trim((string) $request->input('reason'));
        abort_unless(in_array($decision, ['confirm', 'return'], true) && mb_strlen($reason) <= 500, 422, 'Invalid decision.');
        abort_if($decision === 'return' && $reason === '', 422, 'Say what needs to change.');

        Trading::run(function () use ($request, $actor, $decision, $reason) {
            $tx = $this->load($request->input('transaction_id'));
            // T11: the CEO confirms straight after the proposal; rows left in ha_approved stay confirmable.
            abort_unless($tx?->terms && in_array($tx->terms->state, ['proposed', 'ha_approved'], true), 409, 'No financing terms to confirm.');
            $terms = $tx->terms;
            if ($decision === 'return') {
                DB::table('payment_terms')->where('id', $terms->id)->update(['state' => 'returned', 'returned_reason' => $reason, 'updated_at' => now()]);
                Trading::history($tx->id, $tx->current_state, $tx->current_state, $actor, "CEO returned the terms: {$reason}");
                Trading::notify(['role' => 'sales_manager'], 'financing_terms_returned', 'Financing terms returned by the CEO', "Revise and resubmit: {$reason}", $tx->id);

                return;
            }

            $kind = $tx->details->arrangement_kind;
            $deliveryOn = null;
            if ($kind === 'delivery') {
                $slot = DB::table('viewing_arrangements')->where('purchase_transaction_id', $tx->id)->where('arrangement_kind', 'delivery')
                    ->whereIn('confirmation_state', ['pending', 'confirmed'])->first(['schedule']);
                abort_unless($slot, 422, 'The request has no delivery date.');
                $deliveryOn = Trading::when($slot->schedule);
            }
            DB::table('payment_terms')->where('id', $terms->id)->update(['state' => 'approved', 'approver_id' => $actor, 'approval_date' => now(), 'updated_at' => now()]);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $actor, 'CEO confirmed the financing terms');

            $down = Money::cents($terms->down_payment);
            $remaining = Money::cents($terms->total_amount) - $down;
            $monthly = $terms->monthly_payment ? self::peso(Money::cents($terms->monthly_payment))." a month for {$terms->number_of_payments} months" : "{$terms->number_of_payments} monthly payments";

            if ($kind === 'delivery') {
                $fee = Money::cents($terms->delivery_fee);
                $due = BuyRules::addWorkingDays(CarbonImmutable::now(), 3);
                DB::table('purchase_details')->where('transaction_id', $tx->id)->update(['delivery_serviceable' => true, 'delivery_fee' => Money::decimal($fee),
                    'downpayment_amount' => Money::decimal($down), 'downpayment_due_at' => $due, 'updated_at' => now()]);
                Trading::updateTx($tx->id, ['flow_status' => 'purchase_claim']);
                Trading::notify(['userId' => $tx->customer_id], 'financing_offer', 'Your financing and delivery are confirmed',
                    'Delivery fee '.self::peso($fee).' and downpayment '.self::peso($down).': pay '.self::peso($fee + $down).' now through PayMongo, by '
                    .$due->setTimezone('Asia/Manila')->format('n/j/Y').'. Amount financed '.self::peso($remaining).", {$monthly}. Delivery on {$deliveryOn}.", $tx->id);
                Trading::notify(['role' => 'head_accountant'], 'delivery_payment_expected', 'Delivery payments expected',
                    'A buyer will pay a delivery fee of '.self::peso($fee).' and a downpayment of '.self::peso($down).'. Record and verify them on the transaction.', $tx->id);

                return;
            }
            Trading::updateTx($tx->id, ['flow_status' => 'approved_awaiting_buyer_decision']);
            Trading::notify(['userId' => $tx->customer_id], 'financing_offer', 'Your financing is approved', $kind === 'meetup'
                ? 'No downpayment. '.self::peso($remaining)." financed, {$monthly}. Review it and book your meet-up, or decline."
                : 'Initial Downpayment '.self::peso($down).", then {$monthly} on a balance of ".self::peso($remaining).'. Review it and book your GCE visit, or decline.', $tx->id);
        });

        return response()->json(['success' => true]);
    }

    /** §6 step 19: the Initial Downpayment is confirmed (and, in the field, the buyer signed): the account opens. */
    public function complete(Request $request): JsonResponse
    {
        $actor = $this->actor($request, ['head_accountant', 'ceo']);

        Trading::run(function () use ($request, $actor) {
            $tx = $this->load($request->input('transaction_id'));
            abort_unless($tx?->terms, 404, 'Financing request not found.');
            $kind = $tx->details->arrangement_kind;
            abort_if($tx->terms->state !== 'approved' || ($kind !== 'meetup' && $tx->flow_status !== 'initial_dp_confirmed'), 422, $kind === 'meetup'
                ? 'Complete the agreement after the financing is confirmed.'
                : 'Complete the agreement after the Initial Downpayment is confirmed.');
            if ($kind === 'delivery') {
                $status = DB::table('field_cases')->where('transaction_id', $tx->id)->where('case_kind', 'delivery')->where('state', '!=', 'cancelled')->value('delivery_status');
                abort_unless($status === 'delivered', 422, 'Complete the agreement after the car is delivered and the buyer accepts it.');
            }
            if (in_array($kind, ['meetup', 'delivery'], true)) {
                abort_unless(DB::table('sale_handovers')->where('transaction_id', $tx->id)->value('signing_reported_at'), 422,
                    'Complete the agreement after the Confidential Informant reports that the buyer signed.');
            }
            Payments::openFinancingAccount($tx->terms);
            Trading::updateTx($tx->id, ['flow_status' => 'financing_active']);
            Trading::reserveVehicle($tx->vehicle_id);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $actor, 'Financing agreement completed; account active');
            Trading::notify(['role' => 'sales_manager'], 'financing_active', 'Financing is active', 'The financing account is open. Mark the car sold to this buyer.', $tx->id);
        });

        return response()->json(['success' => true]);
    }
}
