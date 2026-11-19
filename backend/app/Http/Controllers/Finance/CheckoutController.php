<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Services\Finance\Money;
use App\Services\Finance\PayMongo;
use App\Services\Finance\Payments;
use App\Services\Finance\PaymentRules;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The buyer pays online on a PayMongo Checkout Session (was src/app/(customer)/my-transactions/online-payment-actions.ts).
 * Rows are recorded unpaid with the session id; the webhook marks them paid. Pay again reuses an open session for
 * the same items and replaces an expired one. PayMongo is called outside any database transaction; the unique keys
 * (one live row per kind and part, one live row per installment) stop a double click from recording twice.
 */
class CheckoutController extends Controller
{
    public function __construct(private PayMongo $paymongo) {}

    private function txFor(Request $request): object
    {
        $id = (string) $request->input('transaction_id');
        abort_unless(Str::isUuid($id), 404, 'Transaction not found.');
        $tx = DB::table('transactions')->where('id', $id)->first(['id', 'customer_id', 'current_state', 'flow_status']);
        abort_unless($tx && $tx->customer_id === $request->user()->id, 404, 'Transaction not found.');

        return $tx;
    }

    /** @return array{name: ?string, email: ?string, phone: ?string} */
    private function billing(Request $request): array
    {
        $profile = DB::table('profiles')->where('id', $request->user()->id)->first(['full_name', 'phone']);

        return ['name' => $profile?->full_name, 'email' => $request->user()->email, 'phone' => $profile?->phone];
    }

    private function back(string $txId, string $flag): string
    {
        return rtrim((string) config('app.frontend_url'), '/')."/customer/my-transactions/{$txId}?{$flag}=1";
    }

    /** An open session: answers with its link, records it when already paid, or drops its unpaid rows. */
    private function reuse(string $checkoutId, ?callable $sameItems, bool $installments): ?JsonResponse
    {
        try {
            $session = $this->paymongo->retrieve($checkoutId);
        } catch (\RuntimeException) {
            $session = null; // An unreadable session is treated as expired and replaced.
        }
        if ($session && $session['paidPaymentId']) {
            Payments::markCheckoutPaid($checkoutId, $session['paidPaymentId']);
            abort(409, 'Your payment is already received. Refresh the page to see it.');
        }
        if ($session && $session['status'] === 'active') {
            if (! $sameItems || $sameItems()) {
                return response()->json(['success' => true, 'url' => $session['checkoutUrl']]);
            }
            $this->paymongo->expire($checkoutId);
        }
        DB::table('payment_records')->where('paymongo_checkout_id', $checkoutId)
            ->when(! $installments, fn ($q) => $q->where('payment_kind', '!=', 'installment'))
            ->whereNull('paid_at')->whereNull('verified_by')->whereNull('rejected_at')->delete();

        return null;
    }

    /** startOnlinePayment: a delivery's fee and downpayment, a financing downpayment, or a Bank Transfer's balance. */
    public function startOnline(Request $request): JsonResponse
    {
        abort_unless($this->paymongo->configured(), 422, 'Online payment is not set up yet.');
        $tx = $this->txFor($request);
        abort_unless($tx->current_state === 'approved', 404, 'Transaction not found.');
        $details = DB::table('purchase_details')->where('transaction_id', $tx->id)->first();
        $terms = DB::table('payment_terms')->where('purchase_transaction_id', $tx->id)->first(['down_payment', 'state']);
        $contract = DB::table('sale_handovers')->where('transaction_id', $tx->id)->value('contract_state');
        $rows = DB::table('payment_records')->where('transaction_id', $tx->id)->get();
        $due = PaymentRules::onlineDue($details, $terms, $tx->flow_status, $contract, $rows);
        abort_if($due === [], 422, 'Nothing is due online right now.');

        $waiting = $rows->first(fn ($r) => $r->payment_kind !== 'installment' && $r->method === 'paymongo' && $r->paymongo_checkout_id && ! $r->paid_at && ! $r->verified_by && ! $r->rejected_at);
        if ($waiting) {
            if ($open = $this->reuse($waiting->paymongo_checkout_id, null, false)) {
                return $open;
            }
            $rows = $rows->reject(fn ($r) => $r->paymongo_checkout_id === $waiting->paymongo_checkout_id);
        }

        // T10: a verified balance part does not block the next part.
        $sent = $rows->reject(fn ($r) => $r->payment_kind === 'balance' && $r->verified_by)->pluck('payment_kind')->all();
        $balanceParts = $rows->where('payment_kind', 'balance')->whereNull('rejected_at')->count();
        $todo = array_values(array_filter($due, fn ($p) => ! in_array($p['kind'], $sent, true)));
        abort_if($todo === [], 422, 'Nothing is left to pay online.');
        abort_if(BuyRules::needsContract($details) && $contract !== 'signed' && collect($todo)->contains(fn ($p) => ! PaymentRules::allowedBeforeSigning($details, $p['kind'])),
            422, 'Sign the contract before paying.');

        $session = $this->open(array_map(fn ($p) => ['name' => $p['label'], 'cents' => $p['cents']], $todo), $tx->id, $request);
        $this->recordOrExpire($session['id'], function () use ($request, $tx, $todo, $balanceParts, $session) {
            Trading::lockTx($tx->id);
            foreach ($todo as $p) {
                DB::table('payment_records')->insert([
                    'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'amount' => Money::decimal($p['cents']), 'method' => 'paymongo',
                    'payment_kind' => $p['kind'], 'part_no' => $p['kind'] === 'balance' ? $balanceParts + 1 : 1, 'recorded_by' => $request->user()->id,
                    'settlement_date' => now()->toDateString(), 'paymongo_checkout_id' => $session['id'], 'created_at' => now(),
                ]);
            }
            // §6 step 17: a claimed car's Initial Downpayment now waits for PayMongo's confirmation.
            if (collect($todo)->contains('kind', 'downpayment')) {
                DB::table('transactions')->where('id', $tx->id)->where('flow_status', 'purchase_claim')->update(['flow_status' => 'initial_dp_awaiting_verification', 'updated_at' => now()]);
            }
        }, 'This payment is already started. Refresh the page.');

        return response()->json(['success' => true, 'url' => $session['checkoutUrl']]);
    }

    /** startInstallmentCheckout (T07 CR1): the next unpaid installment, or the ones ticked in Advanced Payment. */
    public function startInstallment(Request $request): JsonResponse
    {
        abort_unless($this->paymongo->configured(), 422, 'Online payment is not set up yet.');
        $tx = $this->txFor($request);
        abort_unless(in_array($tx->current_state, ['approved', 'completed'], true), 422, 'This financing is not open for payments.');
        $account = DB::table('installment_accounts')->where('purchase_transaction_id', $tx->id)->first(['id', 'state']);
        abort_unless($account?->state === 'active', 422, 'This financing account is not active.');
        $unpaid = PaymentRules::unpaidInstallments(DB::table('installments')->where('account_id', $account->id)->get(['id', 'account_id', 'state', 'due_date', 'amount_due', 'sequence_no']));

        if ($request->input('advanced') === 'yes') {
            $ids = array_map('strval', (array) $request->input('installment_ids', []));
            abort_if($ids === [] || count(array_unique($ids)) !== count($ids) || collect($ids)->contains(fn ($i) => ! Str::isUuid($i)), 422, 'Select one or more unpaid installments.');
            $selected = $unpaid->whereIn('id', $ids)->values();
            abort_unless($selected->count() === count($ids), 422, 'Select unpaid installments from this account only.');
        } else {
            $selected = $unpaid->take(1);
        }
        abort_if($selected->isEmpty(), 422, 'No unpaid installments remain.');

        // An open session is reused only for the same installments; one for others (an abandoned Advanced
        // Payment) is expired and its unpaid rows removed.
        $live = DB::table('payment_records')->where('transaction_id', $tx->id)->where('payment_kind', 'installment')->whereNull('rejected_at')
            ->get(['installment_id', 'paymongo_checkout_id', 'paid_at']);
        $wanted = $selected->pluck('id')->sort()->implode(',');
        foreach ($live->filter(fn ($r) => $r->paymongo_checkout_id && ! $r->paid_at)->pluck('paymongo_checkout_id')->unique() as $checkoutId) {
            $covers = fn () => $live->where('paymongo_checkout_id', $checkoutId)->pluck('installment_id')->sort()->implode(',') === $wanted;
            if ($open = $this->reuse($checkoutId, $covers, true)) {
                return $open;
            }
        }
        abort_if(DB::table('payment_records')->where('transaction_id', $tx->id)->whereIn('installment_id', $selected->pluck('id'))->whereNull('rejected_at')->exists(),
            422, 'A payment for a selected installment is already submitted. Wait for the review.');

        $session = $this->open($selected->map(fn ($i) => ['name' => "Installment {$i->sequence_no} (due {$i->due_date})", 'cents' => Money::cents($i->amount_due)])->all(), $tx->id, $request);
        $this->recordOrExpire($session['id'], function () use ($request, $tx, $selected, $session) {
            Trading::lockTx($tx->id);
            foreach ($selected as $i) {
                DB::table('payment_records')->insert([
                    'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'installment_id' => $i->id, 'amount' => Money::decimal(Money::cents($i->amount_due)),
                    'method' => 'paymongo', 'payment_kind' => 'installment', 'recorded_by' => $request->user()->id, 'submitted_by' => $request->user()->id,
                    'settlement_date' => now()->toDateString(), 'paymongo_checkout_id' => $session['id'], 'created_at' => now(),
                ]);
            }
        }, 'A payment for this installment is already submitted.');

        return response()->json(['success' => true, 'url' => $session['checkoutUrl']]);
    }

    /** @param  list<array{name: string, cents: int}>  $lines */
    private function open(array $lines, string $txId, Request $request): array
    {
        try {
            return $this->paymongo->create($lines, $txId, $this->back($txId, 'paid'), $this->back($txId, 'cancelled'), $this->billing($request));
        } catch (\RuntimeException $e) {
            abort(502, 'PayMongo could not start the payment: '.$e->getMessage());
        }
    }

    /** Records the session's rows; a lost race (unique key) closes the session nobody will pay. */
    private function recordOrExpire(string $checkoutId, \Closure $insert, string $duplicateMessage): void
    {
        try {
            Trading::run($insert);
        } catch (UniqueConstraintViolationException) {
            $this->paymongo->expire($checkoutId);
            abort(409, $duplicateMessage);
        }
    }
}
