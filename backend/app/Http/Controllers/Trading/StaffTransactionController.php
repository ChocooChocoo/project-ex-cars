<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Models\TransactionDocument;
use App\Services\Finance\Money;
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
 * Staff buy-request actions (was the trading half of src/app/(staff)/transactions/actions.ts). Payment
 * recording, verification and installment waivers stay in Next.js until Phase 6.
 */
class StaffTransactionController extends Controller
{
    private const SELL_PAPER_KINDS = ['valid_id', 'orcr', 'official_receipt', 'certificate_of_registration', 'deed_of_sale'];

    private function role(Request $request): string
    {
        return (string) $request->user()->role()?->value;
    }

    private function salesManager(Request $request): void
    {
        abort_unless(in_array($this->role($request), ['sales_manager', 'ceo'], true), 403, 'Only the Sales Manager can do this.');
    }

    /** Buy request plus its live arrangement (loadBuyRequest), the car and the row locked. */
    private function lockBuy(string $id): ?object
    {
        $peek = DB::table('transactions')->where('id', $id)->first(['vehicle_id', 'transaction_kind']);
        if (! $peek || $peek->transaction_kind !== 'buy') {
            return null;
        }
        if ($peek->vehicle_id) {
            DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first();
        }
        $tx = Trading::lockTx($id);
        $tx->arrangement = DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)
            ->whereIn('confirmation_state', ['pending', 'confirmed'])->first(['schedule', 'arrangement_kind', 'confirmation_state']);
        $tx->details = DB::table('purchase_details')->where('transaction_id', $id)->first();

        return $tx;
    }

    /**
     * BC-8: the one rule behind both the approval gate and the button state the page reads
     * (`verified_prerequisites` from StaffTradingReadController::show), so the UI and the API cannot drift: two
     * valid IDs with both sides verified, verified proof of billing, and a verified payslip.
     */
    public static function verifiedPrerequisites(string $id): bool
    {
        $documents = DB::table('transaction_documents')->where('transaction_id', $id)
            ->whereIn('document_kind', TransactionDocument::BUYER_REQUIRED_KINDS)
            ->where('verification_state', 'verified')->get(['document_kind', 'verification_state', 'id_type', 'id_side']);

        return BuyRules::buyerIdsComplete($documents)
            && $documents->contains('document_kind', 'proof_of_billing')
            && $documents->contains('document_kind', 'payslip');
    }

    /** transitionTransaction: the state machine (state-machine.ts) plus the approval and Mark Sold gates. */
    public function transition(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'uuid'],
            'to_state' => ['required', 'in:pending,under_review,approved,rejected,completed,cancelled'],
            // BC-9: a rejection always says why; the customer reads it on the request.
            'reason' => ['required_if:to_state,rejected', 'nullable', 'string', 'max:500'],
        ], [
            'reason.required_if' => 'Give the reason for rejecting this request.',
            '*' => 'Invalid transition.',
        ]);
        $role = $this->role($request);
        $actorId = $request->user()->id;
        $toState = $data['to_state'];
        $reason = ($data['reason'] ?? null) ?: null;

        Trading::run(function () use ($request, $data, $role, $actorId, $toState, $reason) {
            $id = $data['id'];
            $peek = DB::table('transactions')->where('id', $id)->first(['vehicle_id', 'transaction_kind']);
            abort_unless($peek, 404, 'Transaction not found');
            abort_if($peek->transaction_kind === 'sell', 422, 'Sell offers move through the sell review steps.');
            $tx = $this->lockBuy($id);
            $from = $tx->current_state;
            $purchase = $tx->details;
            $financing = $purchase?->payment_method === 'financing';
            // A repeat of the same step finds the request already moved: a stable conflict, no second history row.
            abort_unless(BuyRules::canTransition($from, $toState, $role), $from === $toState ? 409 : 403,
                $from === $toState ? 'This request has already moved. Refresh the page.' : 'This action is not allowed for your role.');

            if ($toState === 'approved') {
                abort_unless(self::verifiedPrerequisites($id), 422,
                    'Verify both valid IDs, the proof of billing, and the latest payslip before approving.');
            }
            $team = null;
            $downpayment = null;
            if ($toState === 'approved' && BuyRules::isHalfwayCashRequest($purchase)) {
                $meetup = DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->where('arrangement_kind', 'meetup')
                    ->whereIn('confirmation_state', ['pending', 'confirmed'])->first(['schedule', 'location']);
                abort_unless($meetup, 422, 'The buyer has not booked the meet-up yet.');
                if ($purchase->payment_method === 'bank_transfer') {
                    // BH-6: the commitment downpayment is 10% of the price, the same rule as PaymentRules::downPayment
                    // and downPaymentFor() in the browser. A typed amount is ignored, never trusted.
                    $price = (float) ($purchase->final_price ?? 0);
                    abort_unless($price > 0, 422, 'Set the vehicle price first.');
                    $downpayment = PaymentRules::downPayment(Money::cents($price)) / 100;
                } else {
                    $informant = $request->input('informant_id');
                    $mechanic = $request->input('mechanic_id');
                    abort_unless(Str::isUuid((string) $informant) && Str::isUuid((string) $mechanic), 422, 'Choose a Confidential Informant and a Mechanic before approving.');
                    abort_unless(Trading::isWorker($informant, 'confidential_informant'), 422, 'Choose an active Confidential Informant.');
                    abort_unless(Trading::isWorker($mechanic, 'mechanic'), 422, 'Choose an active Mechanic.');
                    $team = [$informant, $mechanic, $meetup];
                }
            }
            if ($toState === 'completed') {
                $this->assertReadyForSale($tx, $purchase, $financing);
            }

            $changes = ['current_state' => $toState, 'completed_at' => in_array($toState, Trading::TERMINAL, true) ? now() : null];
            $changes += $toState === 'under_review'
                ? ['flow_status' => 'pending_sm_approval', 'review_due_at' => BuyRules::reviewDueAt()]
                : ($toState === 'completed' && $financing ? ['review_due_at' => null] : ['flow_status' => null, 'review_due_at' => null]);
            abort_unless(Trading::updateTx($id, $changes, $from), 409, 'This request has already moved. Refresh the page.');
            Trading::history($id, $from, $toState, $actorId, $reason);

            if ($team) {
                Trading::openMeetupCase((object) ['id' => $id, 'vehicle_id' => $tx->vehicle_id, 'current_state' => $toState], $team[0], $team[1], $team[2], $actorId);
            }
            if ($downpayment) {
                $due = BuyRules::addWorkingDays(CarbonImmutable::now(), 3);
                DB::table('purchase_details')->where('transaction_id', $id)->update(['downpayment_amount' => $downpayment, 'downpayment_due_at' => $due, 'updated_at' => now()]);
                Trading::notify(['userId' => $tx->customer_id], 'buy_downpayment_due', 'Downpayment due',
                    'Pay the downpayment of ₱'.Trading::peso($downpayment).' through PayMongo before '.$due->setTimezone('Asia/Manila')->format('n/j/Y').'.', $id);
            }
            if ($toState === 'completed') {
                Trading::finalizeBuySale($tx, $actorId, $financing);
            }
            if (in_array($toState, ['rejected', 'cancelled'], true)) {
                Trading::releaseVisitSlots($id);
                Trading::releaseVehicle($tx->vehicle_id, $tx->flow_status);
            }
            if (in_array($toState, ['approved', 'rejected'], true)) {
                Trading::notify(['userId' => $tx->customer_id], "buy_request_{$toState}",
                    $toState === 'approved' ? 'Your purchase request is approved' : 'Your purchase request was rejected',
                    $toState === 'approved'
                        ? ($financing ? 'The Sales Manager will now agree your payment duration and financing terms.' : 'GCE will expect you at the scheduled date and time.')
                        : 'GCE did not approve your request.'.($reason ? " Reason: {$reason}" : '').' Your visit slot has been released.', $id);
            }
            Trading::audit($actorId, "transaction_{$toState}", 'transactions', $id, "Transaction {$id} moved from {$from} to {$toState} by {$role}");
        });

        return response()->json(['success' => true]);
    }

    /** The Mark Sold gates of transitionTransaction (documents, payment, financing, delivery, papers, contract). */
    private function assertReadyForSale(object $tx, ?object $purchase, bool $financing): void
    {
        $id = $tx->id;
        abort_unless(self::verifiedPrerequisites($id), 422, 'Two verified valid IDs and a verified proof of billing are required before completing this purchase.');
        $bankTransfer = $purchase?->payment_method === 'bank_transfer';
        $payments = DB::table('payment_records')->where('transaction_id', $id)
            ->where(fn ($q) => $bankTransfer ? $q->whereNotNull('verified_by') : $q->whereNotNull('verified_by')->orWhere('method', '!=', 'paymongo'))->count();
        $nothingDueYet = $financing && $purchase?->arrangement_kind === 'meetup';
        abort_if(! $payments && ! $nothingDueYet, 422, $bankTransfer
            ? 'The Head Accountant must verify the bank transfer before the car is marked sold.'
            : "Record the buyer's payment before marking the car sold.");
        if ($financing) {
            abort_unless(in_array($tx->flow_status, ['financing_active', 'financing_completed'], true), 422, 'Complete the financing agreement before marking the car sold.');
            $accountId = DB::table('installment_accounts')->where('purchase_transaction_id', $id)->value('id');
            $installments = $accountId ? DB::table('installments')->where('account_id', $accountId)->get(['state']) : collect();
            abort_unless(BuyRules::financingFullyPaid($installments), 422, 'Pay or waive every financing installment before marking the car sold.');
        }
        $delivery = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'delivery')->where('state', '!=', 'cancelled')->first(['delivery_status']);
        abort_if($delivery && $delivery->delivery_status !== 'delivered', 422, 'Mark the car sold after the delivery team reports it delivered.');
        $handover = DB::table('sale_handovers')->where('transaction_id', $id)->first();
        abort_unless(BuyRules::papersReadyForSale($purchase, $handover), 422, 'The Confidential Informant must release the vehicle papers before the car is marked sold.');
        if (! BuyRules::contractReadyForSale($purchase, $handover)) {
            abort_if($handover?->contract_state !== 'signed', 422, 'The buyer must sign the contract before the car is marked sold.');
            $missing = implode(' and the ', BuyRules::missingContractCopies($purchase, $handover));
            abort(422, "The {$missing} has not recorded keeping the signed contract.");
        }
    }

    /** closeBuyRequest: cancelled with a flag, arrangements completed, requested papers returned to the CI. */
    private function closeBuyRequest(object $tx, string $actorId, string $flag, string $reason): void
    {
        abort_unless(Trading::updateTx($tx->id, [
            'current_state' => 'cancelled', 'flag' => $flag, 'flow_status' => null, 'review_due_at' => null, 'completed_at' => now(),
        ], $tx->current_state), 409, 'This request has already moved. Refresh the page.');
        Trading::history($tx->id, $tx->current_state, 'cancelled', $actorId, $reason);
        DB::table('viewing_arrangements')->where('purchase_transaction_id', $tx->id)
            ->whereIn('confirmation_state', ['pending', 'confirmed'])->update(['confirmation_state' => 'completed']);
        $returned = DB::table('sale_handovers')->where('transaction_id', $tx->id)->whereIn('papers_status', ['requested', 'released_to_ci', 'handed_over'])
            ->update(['papers_status' => 'returned', 'papers_updated_at' => now()]);
        if ($returned > 0) {
            Trading::setPapersCustody($tx->id, 'on_hold'); // BC-5 / SN-4: returned papers are On Hold.
        }
    }

    /** recordBuyerDecline (§2 step 5 / §3 step 7). A Legit delivery decline drafts the refund; Phase 6 releases it. */
    public function recordBuyerDecline(Request $request): JsonResponse
    {
        $this->salesManager($request);
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'classification' => ['nullable', 'in:legit,not_legit'], 'reason' => ['nullable', 'string', 'max:500'],
        ], ['*' => 'Invalid request.']);
        $actorId = $request->user()->id;
        Trading::run(function () use ($data, $actorId) {
            $tx = $this->lockBuy($data['transaction_id']);
            abort_unless($tx, 404, 'Transaction not found.');
            abort_if($tx->current_state !== 'approved', 409, 'Only an approved request can be declined at the visit.');
            $papers = DB::table('sale_handovers')->where('transaction_id', $tx->id)->value('papers_status');
            abort_if(BuyRules::isDirectPayment($tx->details) && $papers && $papers !== 'returned', 422,
                'The vehicle papers were already requested, so the buyer can no longer be recorded as declining.');
            $classified = in_array($tx->arrangement?->arrangement_kind, ['meetup', 'delivery'], true);
            $delivery = $tx->arrangement?->arrangement_kind === 'delivery';
            $classification = $data['classification'] ?? null;
            abort_if($classified && ! $classification, 422, 'Classify the decline as Legit or Not Legit.');
            $notLegit = $classified && $classification === 'not_legit';
            $reason = trim((string) ($data['reason'] ?? ''));
            $this->closeBuyRequest($tx, $actorId, 'declined_by_buyer', 'Declined by buyer'
                .($classified ? ' ('.($notLegit ? 'Not Legit, strike' : 'Legit').')' : '').($reason !== '' ? ": {$reason}" : ''));
            if ($notLegit) {
                Trading::recordStandingEvent($tx->customer_id, 'strike', $actorId);
            }
            if (! $delivery) {
                return;
            }
            $downpayment = BuyRules::verifiedPaid(DB::table('payment_records')->where('transaction_id', $tx->id)->get(['payment_kind', 'amount', 'verified_by']), 'downpayment');
            if ($notLegit) {
                DB::table('purchase_details')->where('transaction_id', $tx->id)->update(['downpayment_forfeited_at' => now(), 'updated_at' => now()]);
            } elseif ($downpayment > 0) {
                // §4 step 8: the refund is drafted here; the Head Accountant releases it (Phase 6).
                $refundId = (string) Str::uuid();
                DB::table('disbursement_requests')->insert([
                    'id' => $refundId, 'title' => 'Downpayment refund', 'amount_cents' => (int) round($downpayment * 100),
                    'purpose' => "Refund of a buyer's downpayment after a legitimate decline (transaction {$tx->id})", 'status' => 'draft',
                    'requested_by' => $actorId, 'notes' => 'Refund within 3 working days.', 'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('disbursement_events')->insert([
                    'id' => (string) Str::uuid(), 'disbursement_id' => $refundId, 'event_kind' => 'submitted', 'actor_id' => $actorId,
                    'notes' => 'Downpayment refund — awaiting Head Accountant release.', 'created_at' => now(),
                ]);
                Trading::notify(['role' => 'head_accountant'], 'downpayment_refund', 'Downpayment refund to release',
                    'Refund ₱'.Trading::peso($downpayment).' to the buyer within 3 working days.', $tx->id);
            }
            Trading::notify(['userId' => $tx->customer_id], 'delivery_declined', 'Your purchase was closed', $notLegit
                ? 'The decline was not accepted as legitimate. Your downpayment is forfeited and your account is limited to GCE visits.'
                : 'Your downpayment will be refunded within 3 working days.', $tx->id);
        });

        return response()->json(['success' => true]);
    }

    /** recordNoShow (§3 step 6, §4 step 7c). */
    public function recordNoShow(Request $request): JsonResponse
    {
        $this->salesManager($request);
        $id = $request->input('transaction_id');
        abort_unless(is_string($id) && Str::isUuid($id), 422, 'Invalid request.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($id, $actorId) {
            $tx = $this->lockBuy($id);
            abort_unless($tx, 404, 'Transaction not found.');
            $kind = $tx->arrangement?->arrangement_kind;
            abort_if($tx->current_state !== 'approved' || ! in_array($kind, ['meetup', 'delivery'], true), 409,
                'Only an approved Meet Halfway or Delivery request can be marked as a no-show.');
            $delivery = $kind === 'delivery';
            if ($delivery) {
                $status = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'delivery')->where('state', '!=', 'cancelled')->value('delivery_status');
                abort_unless(in_array($status, ['arriving', 'delivered'], true), 422, 'Record the buyer as unavailable once the delivery team has arrived.');
            } else {
                abort_unless(BuyRules::canRecordNoShow(CarbonImmutable::parse($tx->arrangement->schedule, 'UTC')), 422,
                    'Wait 2 hours 30 minutes after the meet-up time before recording a no-show.');
            }
            $this->closeBuyRequest($tx, $actorId, $delivery ? 'buyer_unavailable' : 'buyer_no_show',
                $delivery ? 'Buyer unavailable at delivery; downpayment forfeited' : "Buyer didn't show up");
            if ($delivery) {
                DB::table('purchase_details')->where('transaction_id', $id)->update(['downpayment_forfeited_at' => now(), 'updated_at' => now()]);
            }
            $standing = Trading::recordStandingEvent($tx->customer_id, 'no_show', $actorId);
            Trading::notify(['userId' => $tx->customer_id], 'buyer_no_show', 'Your meet-up was recorded as a no-show', $standing['gce_visit_only']
                ? 'This is your second no-show. From now on you can only buy through a GCE visit.'
                : 'This counts as one no-show. After two, you can only buy through a GCE visit.', $id);
        });

        return response()->json(['success' => true]);
    }

    /** promoteQueuedRequest (§3 step 5): one Active request per car, held by the database key. */
    public function promoteQueuedRequest(Request $request): JsonResponse
    {
        $this->salesManager($request);
        $id = $request->input('transaction_id');
        abort_unless(is_string($id) && Str::isUuid($id), 422, 'Invalid request.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($id, $actorId) {
            $tx = $this->lockBuy($id);
            abort_unless($tx, 404, 'Transaction not found.');
            abort_if($tx->queue_state !== 'on_hold' || $tx->current_state !== 'pending', 409, 'This request is not On Hold.');
            try {
                DB::transaction(fn () => DB::table('transactions')->where('id', $id)->where('queue_state', 'on_hold')->update([
                    'queue_state' => 'active', 'current_state' => 'under_review', 'flow_status' => 'pending_sm_approval',
                    'review_due_at' => BuyRules::reviewDueAt(), 'updated_at' => now(),
                ]));
            } catch (UniqueConstraintViolationException $e) {
                abort_unless(Trading::isUnique($e, 'transactions_one_active_buyer_per_vehicle'), 500);
                abort(409, 'Another request for this car is still Active. Decide it first.');
            }
            Trading::history($id, 'pending', 'under_review', $actorId, 'Promoted from On Hold to Active by the Sales Manager');
            Trading::notify(['userId' => $tx->customer_id], 'buy_request_active', 'Your request is now Active',
                'The Sales Manager is now reviewing your request (up to 7 days).', $id);
        });

        return response()->json(['success' => true]);
    }

    /** HA verifies papers; SM the required buyer documents; MS a seller's papers. */
    public function verifyTransactionDocument(Request $request): JsonResponse
    {
        $role = $this->role($request);
        abort_unless(in_array($role, ['head_accountant', 'marketing_specialist', 'sales_manager'], true), 403, 'Not authorized to verify purchase documents');
        $documentId = $request->input('document_id');
        $decision = $request->input('decision');
        abort_unless(is_string($documentId) && Str::isUuid($documentId) && in_array($decision, ['verified', 'rejected'], true), 422, 'Invalid verification request.');
        $reason = $decision === 'rejected' ? mb_substr(trim((string) $request->input('reason')), 0, 500) : '';
        $actorId = $request->user()->id;
        Trading::run(function () use ($documentId, $decision, $reason, $role, $actorId) {
            $doc = DB::table('transaction_documents')->where('id', $documentId)->lockForUpdate()->first();
            abort_unless($doc, 404, 'Document not found.');
            abort_if($doc->verification_state !== 'pending', 409, 'Only pending documents can be verified or rejected.');
            $parent = DB::table('transactions')->where('id', $doc->transaction_id)->first(['transaction_kind', 'customer_id']);
            $sellPaper = $parent?->transaction_kind === 'sell' && in_array($doc->document_kind, self::SELL_PAPER_KINDS, true);
            $buyerDocument = $parent?->transaction_kind === 'buy' && in_array($doc->document_kind, TransactionDocument::BUYER_REQUIRED_KINDS, true);
            $allowed = $sellPaper ? $role === 'marketing_specialist'
                : $role === 'head_accountant' || ($role === 'sales_manager' && $buyerDocument);
            abort_unless($allowed, 403, $sellPaper ? "The Marketing Specialist verifies a seller's papers." : 'This document is verified by the Head Accountant.');
            DB::table('transaction_documents')->where('id', $documentId)->update(['verification_state' => $decision, 'verifier_id' => $actorId, 'rejection_reason' => $reason ?: null]);
            if ($decision === 'rejected' && $parent?->customer_id) {
                Trading::notify(['userId' => $parent->customer_id], 'document_resubmission_requested', 'Please resubmit a document',
                    'GCE could not accept your '.str_replace('_', ' ', $doc->document_kind).'.'.($reason ? " What to fix: {$reason}" : '').' Upload a new one on your request page.', $doc->transaction_id);
            }
            if ($buyerDocument) {
                $rejected = DB::table('transaction_documents')->where('transaction_id', $doc->transaction_id)
                    ->whereIn('document_kind', TransactionDocument::BUYER_REQUIRED_KINDS)->where('verification_state', 'rejected')->exists();
                $state = self::verifiedPrerequisites($doc->transaction_id) ? 'verified' : ($rejected ? 'rejected' : 'pending');
                DB::table('purchase_details')->where('transaction_id', $doc->transaction_id)
                    ->update(['document_check_state' => $state, 'checked_by' => $actorId, 'checked_at' => now(), 'updated_at' => now()]);
            }
            Trading::audit($actorId, "purchase_document_{$decision}", 'transaction_documents', $documentId, "Purchase document {$documentId} ({$doc->document_kind}) {$decision}");
        });

        return response()->json(['success' => true]);
    }

    /** createWalkInTransaction. */
    public function createWalkInTransaction(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['ceo', 'sales_manager', 'account_manager'], true), 403, 'Not authorized');
        $data = $request->validate([
            'customer_id' => ['required', 'uuid', 'exists:profiles,id'], 'transaction_kind' => ['required', 'in:buy,sell'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,id'], 'offered_amount' => ['nullable', 'numeric', 'min:0'],
        ]);
        $id = (string) Str::uuid();
        $actorId = $request->user()->id;
        Trading::run(function () use ($id, $data, $actorId) {
            DB::table('transactions')->insert([
                'id' => $id, 'customer_id' => $data['customer_id'], 'transaction_kind' => $data['transaction_kind'], 'vehicle_id' => $data['vehicle_id'] ?? null,
                'current_state' => 'pending', 'created_by' => $actorId, 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            if ($data['transaction_kind'] === 'sell' && isset($data['offered_amount'])) {
                DB::table('sell_details')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $id, 'offered_amount' => $data['offered_amount'], 'created_at' => now(), 'updated_at' => now()]);
            }
            Trading::history($id, 'pending', 'pending', $actorId, "Walk-in {$data['transaction_kind']} transaction created");
        });

        return response()->json(['success' => true, 'id' => $id]);
    }

    /** createFieldCase. A buy's delivery or meet-up case waits for the verified delivery fee and downpayment. */
    public function createFieldCase(Request $request): JsonResponse
    {
        $creators = [
            'acquisition' => ['ceo', 'confidential_informant', 'sales_manager'], 'delivery' => ['ceo', 'confidential_informant', 'sales_manager'],
            'recovery' => ['ceo', 'head_accountant'], 'buyer_meetup' => ['ceo', 'sales_manager'],
        ];
        $kind = (string) $request->input('case_kind');
        abort_unless(in_array($this->role($request), $creators[$kind] ?? [], true), 403, "Not authorized to create {$kind} field cases");
        $data = $request->validate([
            'transaction_id' => ['nullable', 'uuid'], 'vehicle_id' => ['nullable', 'uuid'], 'assigned_confidential_informant' => ['nullable', 'uuid'],
            'mechanic_id' => ['nullable', 'uuid'], 'schedule' => ['nullable', 'string'], 'location' => ['nullable', 'string', 'max:500'], 'notes' => ['nullable', 'string', 'max:1000'],
        ], ['*' => 'Invalid field case.']);
        abort_if(empty($data['transaction_id']) && empty($data['vehicle_id']), 422, 'Select a transaction or a vehicle to link this field case.');
        abort_if(empty($data['assigned_confidential_informant']) && empty($data['mechanic_id']), 422, 'Assign an informant or a mechanic to this field case.');
        $schedule = Trading::parseTime($data['schedule'] ?? null);
        abort_if(! empty($data['schedule']) && ! $schedule, 422, 'Schedule must be a valid date and time.');
        // SH-12: a schedule that already passed would send the team nowhere.
        abort_if($schedule && ! BuyRules::isFutureSchedule($schedule), 422, 'Set a future field case date and time.');
        $transactionId = ($data['transaction_id'] ?? null) ?: null;
        $actorId = $request->user()->id;
        $id = (string) Str::uuid();
        Trading::run(function () use ($id, $kind, $data, $transactionId, $schedule, $actorId) {
            if ($transactionId && in_array($kind, ['delivery', 'buyer_meetup'], true)) {
                $details = DB::table('purchase_details')->where('transaction_id', $transactionId)->first();
                $payments = DB::table('payment_records')->where('transaction_id', $transactionId)->get(['payment_kind', 'amount', 'verified_by']);
                abort_if(DB::table('transactions')->where('id', $transactionId)->exists() && ! BuyRules::upfrontPaymentsCleared($details, $payments), 422,
                    'The buyer must pay the delivery fee and the downpayment, verified, first.');
            }
            DB::table('field_cases')->insert([
                'id' => $id, 'transaction_id' => $transactionId, 'vehicle_id' => ($data['vehicle_id'] ?? null) ?: null, 'case_kind' => $kind,
                'assigned_confidential_informant' => ($data['assigned_confidential_informant'] ?? null) ?: null, 'mechanic_id' => ($data['mechanic_id'] ?? null) ?: null,
                'schedule' => $schedule, 'location' => ($data['location'] ?? null) ?: null, 'state' => 'assigned', 'notes' => ($data['notes'] ?? null) ?: null,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            Trading::audit($actorId, "field_case_created_{$kind}", 'field_cases', $id, "{$kind} field case created for transaction ".($transactionId ?? ($data['vehicle_id'] ?? '')));
        });

        return response()->json(['success' => true, 'id' => $id]);
    }

    /** assignMechanic: the case's own Confidential Informant, or the CEO. */
    public function assignMechanic(Request $request): JsonResponse
    {
        $role = $this->role($request);
        abort_unless(in_array($role, ['confidential_informant', 'ceo'], true), 403, 'Not authorized to assign mechanics');
        $caseId = $request->input('field_case_id');
        $mechanicId = $request->input('mechanic_id');
        abort_unless($caseId && $mechanicId, 422, 'Field case and mechanic are required.');
        $actorId = $request->user()->id;
        Trading::run(function () use ($caseId, $mechanicId, $role, $actorId) {
            $case = DB::table('field_cases')->where('id', $caseId)->lockForUpdate()->first(['id', 'assigned_confidential_informant']);
            abort_unless($case, 404, 'Field case not found.');
            abort_if($role === 'confidential_informant' && $case->assigned_confidential_informant !== $actorId, 403,
                'Only the Confidential Informant assigned to this field case can assign its mechanic.');
            abort_unless(Trading::isWorker($mechanicId, 'mechanic'), 422, 'The selected user is not an active mechanic.');
            DB::table('field_cases')->where('id', $caseId)->update(['mechanic_id' => $mechanicId, 'updated_at' => now()]);
            Trading::audit($actorId, 'mechanic_assigned', 'field_cases', $caseId, "Mechanic {$mechanicId} assigned to field case {$caseId}");
            Trading::notify(['userId' => $mechanicId], 'mechanic_assigned', 'Field case assigned',
                'You have been assigned as the mechanic. Open the case for instructions.', $caseId, 'field_cases');
        });

        return response()->json(['success' => true]);
    }

    /** instructRepossession: Head Accountant, from the 4th consecutive missed installment. */
    public function instructRepossession(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'head_accountant', 403, 'Only the Head Accountant can instruct repossession.');
        $transactionId = $request->input('transaction_id');
        $informantId = $request->input('informant_id');
        abort_unless($transactionId && $informantId, 422, 'Transaction and informant are required.');
        $reason = $request->input('reason') ?: null;
        $headSecurityId = $request->input('head_security_id') ?: null;
        $actorId = $request->user()->id;
        $id = (string) Str::uuid();
        Trading::run(function () use ($id, $transactionId, $informantId, $reason, $headSecurityId, $actorId) {
            abort_unless(Trading::lockTx($transactionId), 404, 'Transaction not found.');
            $accountId = DB::table('installment_accounts')->where('purchase_transaction_id', $transactionId)->value('id');
            abort_unless($accountId, 422, 'No installment account exists for this transaction.');
            $rows = DB::table('installments')->where('account_id', $accountId)->orderBy('due_date')->get(['id', 'state', 'due_date', 'amount_due']);
            $missed = self::consecutiveMissed($rows);
            abort_if($missed < 4, 422, "Repossession starts after 4 missed installments; this account has {$missed}.");
            $unpaid = $rows->reject(fn ($i) => in_array($i->state, ['paid', 'waived'], true));
            abort_if($unpaid->isEmpty(), 422, 'No unpaid installments found for this transaction.');
            $paidTotal = $rows->where('state', 'paid')->sum(fn ($i) => (float) $i->amount_due);
            $statement = 'Paid ₱'.Trading::peso($paidTotal).'; unsettled ₱'.Trading::peso($unpaid->sum(fn ($i) => (float) $i->amount_due))." over {$unpaid->count()} installments ({$missed} missed).";
            abort_if(DB::table('field_cases')->where('transaction_id', $transactionId)->where('case_kind', 'recovery')
                ->whereIn('state', ['assigned', 'accepted', 'in_progress'])->exists(), 409, 'An open recovery case already exists for this transaction.');
            $note = $reason ?? "Repossession instructed for transaction {$transactionId}";
            DB::table('field_cases')->insert([
                'id' => $id, 'transaction_id' => $transactionId, 'case_kind' => 'recovery', 'assigned_confidential_informant' => $informantId,
                'head_security_id' => $headSecurityId, 'state' => 'assigned', 'notes' => "{$note} {$statement}", 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('collection_actions')->insert([
                'id' => (string) Str::uuid(), 'installment_id' => $unpaid->first()->id, 'action_kind' => 'recovery_instruction', 'actor_id' => $actorId,
                'notes' => $note, 'action_time' => now(),
            ]);
            foreach (array_filter([$informantId, $headSecurityId]) as $worker) {
                Trading::notify(['userId' => $worker], 'repossession_assigned', 'Towing requested', ($reason ?? 'Four consecutive missed payments.')." {$statement}", $id, 'field_cases');
            }
            Trading::notify(['role' => 'head_accountant'], 'financing_repossession_due', 'Recovery case opened', $statement, $transactionId);
            Trading::audit($actorId, 'repossession_instructed', 'field_cases', $id, "Repossession instructed for transaction {$transactionId} to informant {$informantId}");
        });

        return response()->json(['success' => true, 'id' => $id]);
    }

    /** recovery.ts consecutiveMissedPayments: unpaid past-due installments, newest first, until a paid one. */
    public static function consecutiveMissed(iterable $rows): int
    {
        $today = now()->toDateString();
        $count = 0;
        foreach (collect($rows)->sortByDesc(fn ($r) => (string) $r->due_date) as $row) {
            if ((string) $row->due_date >= $today) {
                continue;
            }
            if (in_array($row->state, ['paid', 'waived'], true)) {
                break;
            }
            $count++;
        }

        return $count;
    }
}
