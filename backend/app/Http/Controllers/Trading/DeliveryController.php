<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Sales Manager delivery and meet-up steps (was src/app/(staff)/transactions/delivery-actions.ts). Route group: SM, CEO. */
class DeliveryController extends Controller
{
    private const FEE_RANGES = ['calabarzon' => [0, 0], 'luzon' => [8000, 10000], 'visayas' => [10000, 15000], 'mindanao' => [15000, 20000]];

    private const AREA_LABELS = ['calabarzon' => 'CALABARZON', 'luzon' => 'Luzon', 'visayas' => 'Visayas', 'mindanao' => 'Mindanao'];

    private const AREA_BY_PREFIX = [
        '01' => 'luzon', '02' => 'luzon', '03' => 'luzon', '04' => 'calabarzon', '05' => 'luzon', '06' => 'visayas', '07' => 'visayas', '08' => 'visayas',
        '09' => 'mindanao', '10' => 'mindanao', '11' => 'mindanao', '12' => 'mindanao', '13' => 'luzon', '14' => 'luzon', '15' => 'mindanao',
        '16' => 'mindanao', '17' => 'luzon', '18' => 'visayas', '19' => 'mindanao',
    ];

    private static function peso(mixed $amount): string
    {
        return '₱'.Trading::peso((float) $amount);
    }

    /** deliveryBalanceNote (buy-flow.ts). */
    public static function balanceNote(?string $method, string $audience): string
    {
        if ($method === 'financing') {
            return $audience === 'buyer' ? 'The balance is paid in monthly installments under your financing agreement.' : 'Collect nothing on delivery: the balance is financed by GCE.';
        }
        $how = $method === 'bank_transfer' ? 'by bank transfer' : 'in cash';

        return $audience === 'buyer' ? "The balance is paid {$how} on delivery." : "Collect the remaining balance {$how} when the buyer accepts the car.";
    }

    /** loadDelivery: an approved delivery buy, locked, with details, payments, live slot and field case. */
    private function lockDelivery(mixed $id): ?object
    {
        if (! is_string($id) || ! Str::isUuid($id)) {
            return null;
        }
        $peek = DB::table('transactions')->where('id', $id)->first(['vehicle_id', 'transaction_kind']);
        if (! $peek || $peek->transaction_kind !== 'buy') {
            return null;
        }
        if ($peek->vehicle_id) {
            DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first();
        }
        $tx = Trading::lockTx($id);
        $tx->details = DB::table('purchase_details')->where('transaction_id', $id)->lockForUpdate()->first();
        if ($tx->details?->arrangement_kind !== 'delivery') {
            return null;
        }
        $tx->payments = DB::table('payment_records')->where('transaction_id', $id)->get(['payment_kind', 'amount', 'verified_by']);
        $tx->arrangement = DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->where('arrangement_kind', 'delivery')
            ->whereIn('confirmation_state', ['pending', 'confirmed'])->first(['id', 'schedule', 'location']);
        $tx->fieldCase = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'delivery')->where('state', '!=', 'cancelled')
            ->lockForUpdate()->first(['id', 'delivery_status', 'delay_note', 'expected_arrival']);

        return $tx;
    }

    /** setDeliveryTerms (§4 step 5): serviceable, the fee in the region's range, and a 10% downpayment. */
    public function setDeliveryTerms(Request $request): JsonResponse
    {
        $data = $request->validate(['serviceable' => ['required', 'in:yes,no'], 'delivery_fee' => ['nullable', 'numeric', 'min:0']], ['*' => 'Invalid delivery terms.']);
        $actorId = $request->user()->id;
        Trading::run(function () use ($request, $data, $actorId) {
            $tx = $this->lockDelivery($request->input('transaction_id'));
            abort_unless($tx, 404, 'Delivery request not found.');
            abort_if($tx->current_state !== 'approved', 409, 'Set delivery terms after approving the request.');
            abort_if((bool) $tx->details->downpayment_due_at, 409, 'Delivery terms are already set.');
            abort_if($tx->details->payment_method === 'financing' && $data['serviceable'] === 'yes', 422, 'Set the delivery fee and the downpayment in the financing terms.');
            if ($data['serviceable'] === 'no') {
                DB::table('purchase_details')->where('transaction_id', $tx->id)->update(['delivery_serviceable' => false, 'updated_at' => now()]);
                Trading::updateTx($tx->id, ['current_state' => 'rejected', 'completed_at' => now(), 'flow_status' => null], 'approved');
                Trading::history($tx->id, $tx->current_state, 'rejected', $actorId, 'Delivery address is not serviceable');
                Trading::releaseVisitSlots($tx->id);
                Trading::notify(['userId' => $tx->customer_id], 'delivery_not_serviceable', "We can't deliver to your address",
                    'GCE cannot deliver to the address you gave. You can request the car again with a GCE visit or a meet-up.', $tx->id);

                return;
            }
            abort_if(! isset($data['delivery_fee']) || $data['delivery_fee'] === '', 422, 'Set the delivery fee.');
            $region = DB::table('profiles')->where('id', $tx->customer_id)->value('region_code');
            $area = self::AREA_BY_PREFIX[substr((string) $region, 0, 2)] ?? null;
            abort_unless($area, 422, 'Buyer has no region in their profile.');
            $fee = $area === 'calabarzon' ? 0.0 : (float) $data['delivery_fee'];
            [$min, $max] = self::FEE_RANGES[$area];
            abort_unless($fee >= $min && $fee <= $max, 422, 'The delivery fee for '.self::AREA_LABELS[$area].' is '
                .($min === $max ? 'Free delivery' : '₱'.number_format($min).' – ₱'.number_format($max)).'.');
            $price = (float) ($tx->details->final_price ?? 0);
            abort_unless($price > 0, 422, 'Set the vehicle price first.');
            $down = round($price * 0.1);
            $due = BuyRules::addWorkingDays(CarbonImmutable::now(), 3);
            DB::table('purchase_details')->where('transaction_id', $tx->id)->update([
                'delivery_serviceable' => true, 'delivery_fee' => $fee, 'downpayment_amount' => $down, 'downpayment_due_at' => $due, 'updated_at' => now(),
            ]);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $actorId, 'Delivery confirmed: fee '.self::peso($fee).', downpayment '.self::peso($down));
            Trading::notify(['userId' => $tx->customer_id], 'delivery_terms_set', 'Your delivery is confirmed',
                'Pay the delivery fee of '.self::peso($fee).' and the downpayment of '.self::peso($down).' through PayMongo before '
                .$due->setTimezone('Asia/Manila')->format('n/j/Y').'. '.self::balanceNote($tx->details->payment_method, 'buyer'), $tx->id);
            Trading::notify(['role' => 'head_accountant'], 'delivery_payment_expected', 'Delivery payments expected',
                'A buyer will pay a delivery fee of '.self::peso($fee).' and a downpayment of '.self::peso($down).' through PayMongo. Check the receipts and verify them on the transaction.', $tx->id);
        });

        return response()->json(['success' => true]);
    }

    /** createDeliveryFieldCase (§4 step 5): CI and Head Security, after the upfront payments are verified. */
    public function createDeliveryFieldCase(Request $request): JsonResponse
    {
        $informant = $request->input('informant_id');
        $security = $request->input('head_security_id');
        abort_unless(Str::isUuid((string) $informant), 422, 'Choose a Confidential Informant.');
        abort_unless(Str::isUuid((string) $security), 422, 'Choose Head Security.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($request, $informant, $security, $actorId) {
            $tx = $this->lockDelivery($request->input('transaction_id'));
            abort_unless($tx, 404, 'Delivery request not found.');
            abort_if($tx->current_state !== 'approved' || ! $tx->details->delivery_serviceable, 422, 'Set the delivery terms first.');
            abort_if((bool) $tx->fieldCase, 409, 'A delivery field case already exists.');
            abort_unless(BuyRules::upfrontPaymentsCleared($tx->details, $tx->payments), 422, 'The buyer must pay the delivery fee and the downpayment, verified, first.');
            abort_unless($tx->arrangement, 422, 'The request has no delivery date.');
            abort_unless(Trading::isWorker($informant, 'confidential_informant'), 422, 'Choose an active Confidential Informant.');
            abort_unless(Trading::isWorker($security, 'head_security'), 422, 'Choose active Head Security.');
            DB::table('field_cases')->insert([
                'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'vehicle_id' => $tx->vehicle_id, 'case_kind' => 'delivery',
                'assigned_confidential_informant' => $informant, 'head_security_id' => $security, 'schedule' => $tx->arrangement->schedule,
                'location' => $tx->arrangement->location, 'state' => 'assigned',
                'notes' => 'Delivery. '.self::balanceNote($tx->details->payment_method, 'team').' Delivery fee '.self::peso($tx->details->delivery_fee)
                    .', downpayment '.self::peso($tx->details->downpayment_amount).' paid through PayMongo.',
                'created_at' => now(), 'updated_at' => now(),
            ]);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $actorId, 'Delivery field case created');
            foreach ([$informant, $security] as $worker) {
                Trading::notify(['userId' => $worker], 'field_case_assigned', 'New delivery',
                    'Deliver a car on '.Trading::when(CarbonImmutable::parse($tx->arrangement->schedule, 'UTC')).' to '.($tx->arrangement->location ?? "the buyer's address").'.', $tx->id);
            }
        });

        return response()->json(['success' => true]);
    }

    /** createMeetupFieldCase: a financed (or Bank Transfer) meet-up's team, after the contract / downpayment. */
    public function createMeetupFieldCase(Request $request): JsonResponse
    {
        $id = $request->input('transaction_id');
        $informant = (string) $request->input('informant_id', '');
        $mechanic = (string) $request->input('mechanic_id', '');
        abort_unless(is_string($id) && Str::isUuid($id), 422, 'Choose the meet-up team.');
        abort_unless(Str::isUuid($informant), 422, 'Choose a Confidential Informant.');
        abort_unless(Str::isUuid($mechanic), 422, 'Choose a Mechanic.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($id, $informant, $mechanic, $actorId) {
            $tx = Trading::lockTx($id);
            $details = $tx ? DB::table('purchase_details')->where('transaction_id', $id)->first() : null;
            abort_if(! $tx || $tx->transaction_kind !== 'buy' || $tx->current_state !== 'approved' || $details?->arrangement_kind !== 'meetup', 404, 'Approved meet-up request not found.');
            if ($details->payment_method === 'financing') {
                $contract = DB::table('sale_handovers')->where('transaction_id', $id)->value('contract_state');
                abort_unless(in_array($contract, ['approved', 'signed'], true), 422, 'The Head Accountant must approve the contract first.');
            }
            $payments = DB::table('payment_records')->where('transaction_id', $id)->get(['payment_kind', 'amount', 'verified_by']);
            abort_unless(BuyRules::upfrontPaymentsCleared($details, $payments), 422, 'The buyer must pay the downpayment, verified, first.');
            $meetup = DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->where('arrangement_kind', 'meetup')
                ->whereIn('confirmation_state', ['pending', 'confirmed'])->first(['schedule', 'location']);
            abort_unless($meetup, 422, 'The buyer has not booked the meet-up yet.');
            abort_if(DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'buyer_meetup')->where('state', '!=', 'cancelled')->exists(), 409,
                'The meet-up team is already assigned.');
            abort_unless(Trading::isWorker($informant, 'confidential_informant'), 422, 'Choose an active Confidential Informant.');
            abort_unless(Trading::isWorker($mechanic, 'mechanic'), 422, 'Choose an active Mechanic.');
            Trading::openMeetupCase($tx, $informant, $mechanic, $meetup, $actorId);
        });

        return response()->json(['success' => true]);
    }

    /** relayDeliveryDelay (§4 step 7b). */
    public function relayDeliveryDelay(Request $request): JsonResponse
    {
        $actorId = $request->user()->id;
        Trading::run(function () use ($request, $actorId) {
            $tx = $this->lockDelivery($request->input('transaction_id'));
            abort_unless($tx?->fieldCase?->delay_note, 422, 'No delay has been reported.');
            $eta = $tx->fieldCase->expected_arrival ? ' Expected arrival: '.Trading::when(CarbonImmutable::parse($tx->fieldCase->expected_arrival, 'UTC')).'.' : '';
            Trading::notify(['userId' => $tx->customer_id], 'delivery_delayed', 'Your delivery will arrive late',
                "{$tx->fieldCase->delay_note}.{$eta} This delay is on GCE's side and has no effect on your record.", $tx->id);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $actorId, "Delay passed to the buyer: {$tx->fieldCase->delay_note}");
        });

        return response()->json(['success' => true]);
    }

    /** cancelUnpaidDelivery (§4 step 5a): the downpayment deadline passed unpaid. */
    public function cancelUnpaidDelivery(Request $request): JsonResponse
    {
        $actorId = $request->user()->id;
        Trading::run(function () use ($request, $actorId) {
            $tx = $this->lockDelivery($request->input('transaction_id'));
            abort_unless($tx, 404, 'Delivery request not found.');
            $due = $tx->details->downpayment_due_at;
            abort_if($tx->current_state !== 'approved' || ! $due || CarbonImmutable::parse($due, 'UTC')->isFuture(), 409, 'The downpayment deadline has not passed.');
            abort_if(BuyRules::verifiedPaid($tx->payments, 'downpayment') >= (float) ($tx->details->downpayment_amount ?? 0), 409, 'The downpayment is already paid.');
            Trading::updateTx($tx->id, ['current_state' => 'cancelled', 'completed_at' => now(), 'flow_status' => null], 'approved');
            Trading::history($tx->id, $tx->current_state, 'cancelled', $actorId, 'Downpayment not paid by the deadline');
            Trading::releaseVisitSlots($tx->id);
            if ($tx->fieldCase) {
                DB::table('field_cases')->where('id', $tx->fieldCase->id)->update(['state' => 'cancelled', 'updated_at' => now()]);
            }
            Trading::notify(['userId' => $tx->customer_id], 'delivery_cancelled_unpaid', 'Your delivery request was cancelled',
                'The downpayment was not received by the deadline, so the request has been cancelled.', $tx->id);
        });

        return response()->json(['success' => true]);
    }
}
