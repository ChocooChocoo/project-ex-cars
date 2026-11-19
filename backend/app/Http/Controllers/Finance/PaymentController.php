<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\Finance\Money;
use App\Services\Finance\Payments;
use App\Services\Finance\PaymentRules;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Staff payment steps (was src/app/(staff)/transactions/payment-actions.ts and payment-review-actions.ts). Amounts
 * are decided by the server from the sale or the installment, never taken from the form. Each step locks the
 * transaction, then the payment row; repeats answer with the same message and change nothing.
 */
class PaymentController extends Controller
{
    private const KINDS = ['full', 'delivery_fee', 'downpayment', 'balance', 'reschedule_fee', 'installment'];

    private function role(Request $request): string
    {
        return (string) $request->user()->role()?->value;
    }

    /** recordPayment: the Sales Manager records money received; the Head Accountant verifies it later. */
    public function record(Request $request, FileService $files): JsonResponse
    {
        $role = $this->role($request);
        abort_unless(in_array($role, ['ceo', 'sales_manager', 'account_manager', 'head_accountant'], true), 403, 'Not authorized');
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'],
            'installment_id' => ['nullable', 'uuid'],
            'amount' => ['required', 'numeric', 'min:0'],
            'method' => ['required', 'in:cash,financing,bank_transfer'],
            'external_reference' => ['nullable', 'string', 'max:100'],
            'settlement_date' => ['required', 'string'],
            'payment_kind' => ['nullable', 'in:'.implode(',', self::KINDS)],
        ], ['amount.min' => 'Amount cannot be negative.', 'settlement_date.required' => 'Settlement date is required.', '*' => 'Invalid payment record.']);
        $txId = $data['transaction_id'];
        $installmentId = $data['installment_id'] ?? null;
        abort_if($role === 'head_accountant' && ! $installmentId, 422, 'The Sales Manager records the payment. The Head Accountant verifies it.');
        abort_if($installmentId && ! in_array($role, ['sales_manager', 'ceo'], true), 422, 'The Sales Manager records the installment. The Head Accountant verifies it.');

        $proof = $request->file('proof');
        if ($proof && $proof->getSize() > 0) {
            abort_unless(in_array($proof->getMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true), 422, 'The payment photo must be a JPG, PNG or WebP.');
        } else {
            $proof = null;
        }

        $stored = null;
        try {
            [$cents, $kind] = Trading::run(function () use ($request, $files, $data, $txId, $installmentId, $proof, &$stored) {
                abort_unless(Trading::lockTx($txId), 404, 'Transaction not found.');
                $cents = Money::cents($data['amount']);
                $method = $data['method'];
                $kind = $installmentId ? 'installment' : ($data['payment_kind'] ?? null);

                if ($installmentId) {
                    // T07 CR1: an installment is always its scheduled amount, paid in cash at GCE.
                    $installment = DB::table('installments as i')->join('installment_accounts as a', 'a.id', '=', 'i.account_id')
                        ->where('i.id', $installmentId)->first(['i.amount_due', 'a.purchase_transaction_id']);
                    abort_unless($installment && $installment->purchase_transaction_id === $txId, 422, 'Installment not found.');
                    [$cents, $method] = [Money::cents($installment->amount_due), 'cash'];
                } else {
                    $details = DB::table('purchase_details')->where('transaction_id', $txId)->first();
                    $handover = DB::table('sale_handovers')->where('transaction_id', $txId)->first(['contract_state']);
                    if ($details?->payment_method === 'cash') {
                        // T05: one cash payment due at a time; the server decides kind and amount.
                        $payments = DB::table('payment_records')->where('transaction_id', $txId)->get(['payment_kind', 'amount', 'verified_by', 'rejected_at']);
                        $flow = DB::table('transactions')->where('id', $txId)->value('flow_status');
                        $due = PaymentRules::nextCashDue($details, $payments, $flow);
                        abort_unless($due, 422, 'Nothing is due on this purchase.');
                        [$cents, $method, $kind] = [$due['cents'], $due['method'], $due['kind']];
                    }
                    abort_if(BuyRules::needsContract($details) && $handover?->contract_state !== 'signed' && ! PaymentRules::allowedBeforeSigning($details, $kind),
                        422, 'The buyer must sign the contract before a payment is recorded.');
                }

                if ($proof) {
                    $stored = $files->store($proof, 'transaction-documents', $txId, 'proof');
                }
                DB::table('payment_records')->insert([
                    'id' => (string) Str::uuid(), 'transaction_id' => $txId, 'installment_id' => $installmentId, 'amount' => Money::decimal($cents),
                    'method' => $method, 'external_reference' => ($data['external_reference'] ?? '') ?: null, 'recorded_by' => $request->user()->id,
                    'settlement_date' => $data['settlement_date'], 'payment_kind' => $kind, 'proof_path' => $stored['path'] ?? null, 'created_at' => now(),
                ]);
                if ($kind === 'downpayment') {
                    DB::table('transactions')->where('id', $txId)->where('flow_status', 'purchase_claim')->update(['flow_status' => 'initial_dp_awaiting_verification', 'updated_at' => now()]);
                }
                Trading::notify(['role' => 'head_accountant'], 'installment_recorded', 'Payment waiting for your confirmation',
                    '₱'.Money::peso($cents).' recorded for '.($kind ? str_replace('_', ' ', $kind) : 'payment').'. Verify it to count the payment.', $txId);
                Trading::audit($request->user()->id, 'payment_recorded', 'payment_records', $txId, 'Payment of PHP '.Money::decimal($cents)." recorded for transaction {$txId}");

                return [$cents, $kind];
            });
        } catch (UniqueConstraintViolationException) {
            $files->delete('transaction-documents', $stored['path'] ?? null);
            abort(409, 'This payment is already recorded.');
        } catch (\Throwable $e) {
            $files->delete('transaction-documents', $stored['path'] ?? null);
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /** recordAdvancePayment (T11): several installments in cash at once; each amount read from the schedule. */
    public function recordAdvance(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['sales_manager', 'ceo'], true), 403, 'The Sales Manager records the advance payment.');
        $txId = (string) $request->input('transaction_id');
        abort_unless(Str::isUuid($txId), 422, 'Invalid request.');
        $ids = array_values(array_unique(array_filter(array_map('strval', (array) $request->input('installment_ids', [])))));
        abort_if($ids === [], 422, 'Pick at least one installment to pay in advance.');
        foreach ($ids as $id) {
            abort_unless(Str::isUuid($id), 422, 'Installment not found.');
        }

        try {
            $count = Trading::run(function () use ($request, $txId, $ids) {
                abort_unless(Trading::lockTx($txId), 404, 'Transaction not found.');
                $rows = DB::table('installments as i')->join('installment_accounts as a', 'a.id', '=', 'i.account_id')
                    ->whereIn('i.id', $ids)->lockForUpdate()->get(['i.id', 'i.amount_due', 'i.state', 'a.purchase_transaction_id']);
                abort_unless($rows->count() === count($ids) && $rows->every(fn ($r) => $r->purchase_transaction_id === $txId), 422, 'Installment not found.');
                abort_if($rows->contains(fn ($r) => in_array($r->state, ['paid', 'waived'], true)), 422, 'This installment is already settled.');
                foreach ($rows as $row) {
                    DB::table('payment_records')->insert([
                        'id' => (string) Str::uuid(), 'transaction_id' => $txId, 'installment_id' => $row->id, 'amount' => Money::decimal(Money::cents($row->amount_due)),
                        'method' => 'cash', 'recorded_by' => $request->user()->id, 'settlement_date' => now()->toDateString(), 'payment_kind' => 'installment', 'created_at' => now(),
                    ]);
                }
                $total = Money::sum($rows, 'amount_due');
                $n = $rows->count();
                Trading::notify(['role' => 'head_accountant'], 'installment_recorded', 'Advance payment waiting for your confirmation',
                    'The Sales Manager recorded ₱'.Money::peso($total)." for {$n} installment".($n === 1 ? '' : 's').'. Confirm them.', $txId);
                Trading::audit($request->user()->id, 'advance_payment_recorded', 'payment_records', $txId, 'Advance payment of PHP '.Money::decimal($total)." recorded for {$n} installments");

                return $n;
            });
        } catch (UniqueConstraintViolationException) {
            abort(409, 'This installment is already recorded.');
        }

        return response()->json(['success' => true, 'recorded' => $count]);
    }

    /** verifyPayment: the Head Accountant confirms a recorded payment; it then counts. */
    public function verify(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['ceo', 'head_accountant'], true), 403, 'Not authorized');
        $paymentId = (string) $request->input('payment_id');
        abort_unless(Str::isUuid($paymentId), 404, 'Payment not found.');
        $actor = $request->user()->id;

        Trading::run(function () use ($paymentId, $actor) {
            $txId = DB::table('payment_records')->where('id', $paymentId)->value('transaction_id');
            abort_unless($txId, 404, 'Payment not found.');
            $sale = Trading::lockTx($txId);
            $p = DB::table('payment_records')->where('id', $paymentId)->lockForUpdate()->first();
            abort_if($p->rejected_at, 409, 'This payment was rejected.');
            abort_if($p->verified_by, 409, 'This payment is already verified.');
            abort_if($p->payment_kind === 'installment' && $p->method === 'paymongo' && ! $p->approved_at, 422, 'The Sales Manager must approve this online payment first.');
            if ($p->installment_id) {
                $due = DB::table('installments')->where('id', $p->installment_id)->lockForUpdate()->value('amount_due');
                abort_unless($due !== null && Money::cents($due) === Money::cents($p->amount), 422, 'The payment amount does not match the installment.');
            }
            DB::table('payment_records')->where('id', $paymentId)->update(['verified_by' => $actor]);

            if ($p->installment_id) {
                DB::table('installments')->where('id', $p->installment_id)->update(['state' => 'paid', 'payment_date' => $p->settlement_date ?? now()->toDateString()]);
                Payments::closeFinancingIfPaid($txId);
                Trading::notify(['userId' => $sale->customer_id], 'installment_verified', 'Your installment payment is verified', 'The Head Accountant verified your installment. It now counts toward your financing.', $txId);
                Trading::notify(['role' => 'sales_manager'], 'installment_verified', 'Installment verified by the Head Accountant', "The buyer's installment now counts as paid.", $txId);
            }
            Payments::confirmInitialDownpaymentIfPaid($txId);
            Payments::notifyInformantIfPaidInFull($txId);
            // T10: a verified re-scheduling fee releases the buyer's new delivery time to the team.
            if ($p->payment_kind === 'reschedule_fee') {
                $pending = DB::table('purchase_details')->where('transaction_id', $txId)->first(['reschedule_pending_at', 'reschedule_pending_location']);
                if ($pending?->reschedule_pending_at && $pending->reschedule_pending_location) {
                    Trading::applyDeliveryReschedule((object) ['id' => $txId, 'current_state' => 'approved'], CarbonImmutable::parse($pending->reschedule_pending_at),
                        $pending->reschedule_pending_location, Money::cents($p->amount) / 100, $actor);
                }
            }
        });

        return response()->json(['success' => true]);
    }

    /** markInstallmentWaived: the installment no longer has to be paid; a fully settled account closes. */
    public function waive(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['ceo', 'account_manager', 'head_accountant'], true), 403, 'Not authorized');
        $installmentId = (string) $request->input('installment_id');
        abort_unless(Str::isUuid($installmentId), 404, 'Installment not found.');

        Trading::run(function () use ($request, $installmentId) {
            $txId = DB::table('installments as i')->join('installment_accounts as a', 'a.id', '=', 'i.account_id')->where('i.id', $installmentId)->value('a.purchase_transaction_id');
            if (! $txId) {
                return; // As before: an unknown installment changes nothing.
            }
            Trading::lockTx($txId);
            DB::table('installments')->where('id', $installmentId)->update(['state' => 'waived']);
            Payments::closeFinancingIfPaid($txId);
            Trading::audit($request->user()->id, 'installment_waived', 'installments', $installmentId, "Installment {$installmentId} waived");
        });

        return response()->json(['success' => true]);
    }

    /** approveOnlineInstallment (T07 CR1): the Sales Manager accepts a PayMongo installment for verification. */
    public function approveOnline(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['ceo', 'sales_manager'], true), 403, 'Not authorized');
        $paymentId = (string) $request->input('payment_id');
        abort_unless(Str::isUuid($paymentId), 404, 'Payment not found.');

        Trading::run(function () use ($request, $paymentId) {
            $txId = DB::table('payment_records')->where('id', $paymentId)->value('transaction_id');
            abort_unless($txId, 404, 'Payment not found.');
            $sale = Trading::lockTx($txId);
            $p = DB::table('payment_records')->where('id', $paymentId)->lockForUpdate()->first();
            abort_if($p->rejected_at, 409, 'This payment was rejected.');
            abort_if($p->verified_by, 409, 'This payment is already verified.');
            abort_if($p->approved_at, 409, 'This payment is already approved.');
            abort_unless($p->payment_kind === 'installment' && $p->method === 'paymongo', 422, 'Only an online installment needs Sales Manager approval.');
            abort_unless($p->paymongo_payment_id, 422, 'PayMongo has not confirmed this payment yet.');
            DB::table('payment_records')->where('id', $paymentId)->update(['approved_by' => $request->user()->id, 'approved_at' => now()]);
            $amount = Money::currency(Money::cents($p->amount));
            Trading::notify(['role' => 'head_accountant'], 'installment_approved', 'Online installment ready to verify', "The Sales Manager approved a {$amount} online installment. Verify it to count the payment.", $txId);
            Trading::notify(['userId' => $sale->customer_id], 'installment_approved', 'Your online payment is approved', "Your {$amount} installment payment passed the Sales Manager. The Head Accountant verifies it next.", $txId);
            Trading::audit($request->user()->id, 'installment_approved', 'payment_records', $paymentId, 'Online installment of PHP '.Money::decimal(Money::cents($p->amount)).' approved for Head Accountant verification');
        });

        return response()->json(['success' => true]);
    }

    /** rejectPayment (T03 HA3): stays on record as rejected, stops counting, reopens its installment. */
    public function reject(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['ceo', 'head_accountant'], true), 403, 'Not authorized');
        $paymentId = (string) $request->input('payment_id');
        $text = trim((string) $request->input('reason'));
        abort_if($text === '', 422, 'Give a reason for rejecting.');
        abort_if(mb_strlen($text) > 1000, 422, 'Keep the reason under 1000 characters.');
        abort_unless(Str::isUuid($paymentId), 404, 'Payment not found.');

        Trading::run(function () use ($request, $paymentId, $text) {
            $txId = DB::table('payment_records')->where('id', $paymentId)->value('transaction_id');
            abort_unless($txId, 404, 'Payment not found.');
            $sale = Trading::lockTx($txId);
            $p = DB::table('payment_records')->where('id', $paymentId)->lockForUpdate()->first();
            abort_if($p->verified_by || $p->rejected_at, 409, 'Only a payment waiting for verification can be rejected.');
            DB::table('payment_records')->where('id', $paymentId)->update(['rejected_by' => $request->user()->id, 'rejected_at' => now(), 'rejection_reason' => $text]);
            if ($p->installment_id) {
                $today = now('Asia/Manila')->toDateString();
                $due = (string) (DB::table('installments')->where('id', $p->installment_id)->value('due_date') ?? $today);
                DB::table('installments')->where('id', $p->installment_id)->update(['state' => PaymentRules::installmentStateFor($due, $today), 'payment_date' => null]);
            }
            $amount = Money::currency(Money::cents($p->amount));
            Trading::notify(['userId' => $sale->customer_id], 'payment_rejected', 'A payment was not accepted', "Your payment of {$amount} was not accepted: {$text}", $txId);
            Trading::audit($request->user()->id, 'payment_rejected', 'payment_records', $paymentId, 'Payment of PHP '.Money::decimal(Money::cents($p->amount))." rejected: {$text}");
        });

        return response()->json(['success' => true]);
    }
}
