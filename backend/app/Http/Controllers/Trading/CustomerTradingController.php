<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Jobs\CheckTransactionDocument;
use App\Services\FileService;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Customer buy and sell actions (was src/app/(customer)/my-transactions/actions.ts and review-actions.ts).
 * Route group: role = customer. Every action answers the result shape the old Server Action returned;
 * a refused step answers {code, message} with 4xx, which the browser module turns into `{ error }`.
 * Payment checkout (startOnlinePayment, startInstallmentCheckout, the paid re-schedule fee) is Phase 6.
 */
class CustomerTradingController extends Controller
{
    public const ID_TYPES = ['passport', 'drivers_license', 'umid', 'sss_id', 'gsis_id', 'philhealth_id', 'voters_id', 'national_id', 'prc_id', 'postal_id'];

    private const BUCKET = 'transaction-documents';

    /** The customer's own transaction, or 404 (another customer's id is never confirmed). */
    private function ownTx(Request $request, ?string $id, string $message = 'Transaction not found.', bool $lock = false): object
    {
        abort_unless(is_string($id) && Str::isUuid($id), 404, $message);
        $query = DB::table('transactions')->where('id', $id);
        if ($lock) {
            // Lock order (Trading): the car before the transaction, so buyers of one car queue instead of deadlocking.
            $vehicleId = DB::table('transactions')->where('id', $id)->value('vehicle_id');
            if ($vehicleId) {
                DB::table('vehicles')->where('id', $vehicleId)->lockForUpdate()->first();
            }
            $query->lockForUpdate();
        }
        $tx = $query->first();
        abort_unless($tx && $tx->customer_id === $request->user()->id, 404, $message);

        return $tx;
    }

    /**
     * T10: a Buying location is a PSGC address, like the profile, and saving it updates the profile too.
     * Next.js composes the one-line `address` from the PSGC names it holds (as for the profile form).
     */
    private function saveBuyerAddress(Request $request): string
    {
        $data = $request->validate([
            'address' => ['required', 'string', 'max:500'],
            'address_line' => ['nullable', 'string', 'max:200'],
            'region_code' => ['required', 'regex:/^\d{9}$/'],
            'province_code' => ['nullable', 'regex:/^\d{9}$/'],
            'city_code' => ['required', 'regex:/^\d{9}$/'],
            'barangay_code' => ['required', 'regex:/^\d{9}$/'],
        ], [
            'address.*' => 'Choose the region, city and barangay.',
            'region_code.*' => 'Choose your region.',
            'province_code.*' => 'Choose a province from the list.',
            'city_code.*' => 'Choose your city or municipality.',
            'barangay_code.*' => 'Choose your barangay.',
        ]);
        DB::table('profiles')->where('id', $request->user()->id)->update($data + ['updated_at' => now()]);

        return $data['address'];
    }

    // ---- Documents ----------------------------------------------------------------------------------

    /**
     * POST /trading/uploads: stores a picked file at the key the browser chose, after checking it is a
     * key this customer may write: `{own transaction id}/{valid_id|proof_of_billing|signature}-...`, or a
     * key granted by prepareSellUploads (signed `token`). The action that uses the path checks it again.
     */
    public function upload(Request $request, FileService $files): JsonResponse
    {
        $request->validate(['path' => ['required', 'string', 'max:300'], 'file' => ['required', 'file']]);
        $path = (string) $request->input('path');
        $token = $request->input('token');
        if (is_string($token) && $token !== '') {
            abort_unless(self::validGrant($request->user()->id, $path, $token), 403, 'This upload link has expired. Try again.');
        } else {
            abort_unless(preg_match('#^([0-9a-f-]{36})/(valid_id|proof_of_billing|signature)-[\w.-]+$#i', $path, $m) === 1, 422, 'Invalid upload.');
            $this->ownTx($request, $m[1]);
        }
        $files->storeAt($request->file('file'), self::BUCKET, $path);

        return response()->json(['path' => $path]);
    }

    private static function grantToken(string $userId, string $path, int $expires): string
    {
        return $expires.'.'.hash_hmac('sha256', "{$userId}|{$path}|{$expires}", (string) config('app.key'));
    }

    private static function validGrant(string $userId, string $path, string $token): bool
    {
        [$expires] = explode('.', $token, 2) + [''];

        return ctype_digit($expires) && (int) $expires >= time() && hash_equals(self::grantToken($userId, $path, (int) $expires), $token);
    }

    /** uploadPurchaseDocument. */
    public function uploadPurchaseDocument(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'],
            'document_kind' => ['required', 'in:valid_id,proof_of_billing'],
            'id_type' => ['nullable', 'in:'.implode(',', self::ID_TYPES)],
            'id_side' => ['nullable', 'in:front,back'],
        ], ['*' => 'Invalid document upload.']);
        $transactionId = $data['transaction_id'];
        $kind = $data['document_kind'];
        $idType = $data['id_type'] ?? null;
        $idSide = $data['id_side'] ?? null;
        $path = $request->input('storage_path');
        abort_unless(is_string($path) && str_starts_with($path, "{$transactionId}/{$kind}-") && app(FileService::class)->exists(self::BUCKET, $path), 422, 'Select a file to upload.');
        abort_if($kind === 'valid_id' && ! $idType, 422, 'Select the ID type.');
        abort_if($kind === 'valid_id' && ! $idSide, 422, 'Select front or back of the ID.');

        Trading::run(function () use ($request, $transactionId, $kind, $idType, $idSide, $path) {
            $tx = $this->ownTx($request, $transactionId, lock: true);
            abort_if($tx->transaction_kind !== 'buy', 422, 'Documents can only be uploaded for purchases.');
            if ($kind === 'valid_id') {
                $ids = BuyRules::activeBuyerIds(DB::table('transaction_documents')->where('transaction_id', $transactionId)->get());
                abort_if(count($ids) >= 4, 422, 'You can upload four ID images: the front and back of two IDs.');
                abort_if(collect($ids)->contains(fn ($d) => $d->id_type === $idType && $d->id_side === $idSide), 422, 'That side of this ID is already uploaded.');
            }
            $id = (string) Str::uuid();
            DB::table('transaction_documents')->insert([
                'id' => $id, 'transaction_id' => $transactionId, 'document_kind' => $kind,
                'id_type' => $kind === 'valid_id' ? $idType : null, 'id_side' => $kind === 'valid_id' ? $idSide : null,
                'storage_path' => $path, 'uploader_id' => $request->user()->id, 'verification_state' => 'pending',
                'auto_check_status' => $kind === 'valid_id' && $idSide === 'front' ? 'pending' : null,
                'upload_date' => now(),
            ]);
            // T03 SM2: advisory auto-check after the commit; the front of an ID carries what the check reads.
            if ($kind === 'valid_id' && $idSide === 'front') {
                CheckTransactionDocument::dispatch($id, 'valid_id', $idType)->afterCommit();
            }
        });

        return response()->json(['success' => true]);
    }

    /** removePurchaseDocument: only while the request is a draft and the image is unverified. */
    public function removePurchaseDocument(Request $request, FileService $files, string $documentId): JsonResponse
    {
        abort_unless(Str::isUuid($documentId), 422, 'Invalid document.');
        $path = Trading::run(function () use ($request, $documentId) {
            $document = DB::table('transaction_documents')->where('id', $documentId)->lockForUpdate()->first();
            abort_unless($document, 404, 'Document not found.');
            $tx = $this->ownTx($request, $document->transaction_id, 'Document not found.', true);
            abort_if($tx->current_state !== 'pending', 422, 'This request has already been sent, so its documents can no longer be removed.');
            abort_if($document->verification_state !== 'pending', 422, 'Only a document still waiting for verification can be removed.');
            DB::table('transaction_documents')->where('id', $documentId)->delete();

            return $document->storage_path;
        });
        $files->delete(self::BUCKET, $path);

        return response()->json(['success' => true]);
    }

    // ---- Buying ---------------------------------------------------------------------------------------

    /** createBuyTransaction: a draft buy request plus its chat thread. */
    public function createBuyTransaction(Request $request): JsonResponse
    {
        $request->validate(['vehicle_id' => ['required', 'uuid']], ['*' => 'Invalid buy request.']);
        $vehicleId = (string) $request->input('vehicle_id');
        abort_unless(DB::table('vehicles')->where('id', $vehicleId)->exists(), 422, 'Invalid buy request.');
        $userId = $request->user()->id;
        $id = (string) Str::uuid();
        Trading::run(function () use ($id, $userId, $vehicleId) {
            DB::table('transactions')->insert([
                'id' => $id, 'customer_id' => $userId, 'transaction_kind' => 'buy', 'vehicle_id' => $vehicleId,
                'current_state' => 'pending', 'created_by' => $userId, 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('inquiries')->insert([
                'id' => (string) Str::uuid(), 'customer_id' => $userId, 'vehicle_id' => $vehicleId, 'intention_kind' => 'buy_now',
                'created_at' => now(), 'updated_at' => now(),
            ]);
            Trading::history($id, 'pending', 'pending', $userId, 'Transaction created');
        });

        return response()->json(['success' => true, 'id' => $id]);
    }

    /** saveBuyDetails: payment option/method, arrangement, slot (locked per car and hour) and location. */
    public function saveBuyDetails(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'],
            'payment_option' => ['nullable', 'in:full,financing'],
            'payment_method' => ['required', 'in:cash,financing,down_payment,bank_transfer'],
            'arrangement_kind' => ['nullable', 'in:delivery,meetup,gce_visit'],
            'schedule' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:500'],
            'acknowledge_condition' => ['nullable', 'in:yes'],
            'agree_delivery_terms' => ['nullable', 'in:yes'],
            'requested_term_months' => ['nullable', 'in:6,12,24,36,60'],
            'financing_pay_method' => ['nullable', 'in:cash,paymongo'],
        ], ['payment_method.*' => 'Select a payment method.', 'requested_term_months.*' => 'Choose a payment term.', '*' => 'Invalid purchase details.']);
        $userId = $request->user()->id;
        $kind = $data['arrangement_kind'] ?? null;
        $picked = $data['payment_method'];
        $option = ($data['payment_option'] ?? null) ?: ($picked === 'financing' ? 'financing' : 'full');
        abort_if($option === 'full' && $picked === 'financing', 422, 'Select a payment method.');
        $method = $option === 'financing' ? 'financing' : $picked;
        $slot = Trading::parseTime($data['schedule'] ?? null);
        abort_if(! empty($data['schedule']) && ! $slot, 422, 'Pick a future date and time.');
        abort_if($slot && ! $slot->isFuture(), 422, 'Pick a future date and time.');
        abort_if($slot && ! BuyRules::isBusinessSlot($slot), 422, BuyRules::SLOT_RULE_MESSAGE);
        abort_if($slot && $kind === 'delivery' && ! BuyRules::isDeliveryDate($slot), 422, BuyRules::DELIVERY_LEAD_MESSAGE);

        $result = Trading::run(function () use ($request, $data, $userId, $kind, $option, $method, $slot) {
            $tx = $this->ownTx($request, $data['transaction_id'], lock: true);
            abort_if($tx->transaction_kind !== 'buy', 422, 'Purchase details can only be saved for buy transactions.');
            // A submitted request (in review, or queued On Hold) keeps its details and time until it is decided.
            abort_if(($tx->current_state && $tx->current_state !== 'pending') || $tx->queue_state, 422, 'This request is already under review and can no longer be changed.');
            // Appendix C: after 2 no-shows or a Not Legit decline, a buyer may only visit GCE.
            if ($kind && $kind !== 'gce_visit') {
                abort_if((bool) DB::table('customer_standing')->where('account_id', $userId)->value('gce_visit_only'), 422, 'Your account is limited to GCE visits.');
            }
            $existing = DB::table('purchase_details')->where('transaction_id', $tx->id)->lockForUpdate()->first();
            $needsAck = in_array($kind, ['meetup', 'delivery'], true) || $method === 'financing';
            $ack = ($data['acknowledge_condition'] ?? null) === 'yes';
            $terms = ($data['agree_delivery_terms'] ?? null) === 'yes';
            abort_if($needsAck && ! $ack && ! $existing?->condition_acknowledged_at, 422,
                "Review the car's condition and 360° view, then acknowledge it before choosing Meet Halfway or Delivery.");
            abort_if($kind === 'delivery' && ! $terms && ! $existing?->delivery_terms_agreed_at, 422, 'Read the delivery terms and tick I agree.');
            $financing = $method === 'financing';
            abort_if($financing && empty($data['requested_term_months']), 422, 'Choose a payment term.');
            $payMethod = $financing ? ($data['financing_pay_method'] ?? null) : null;

            $location = trim((string) ($data['location'] ?? ''));
            if (in_array($kind, ['meetup', 'delivery'], true)) {
                abort_if($location === '' && ! $request->filled('address'), 422, 'Enter a location for meet-up or delivery.');
                $location = $this->saveBuyerAddress($request);
            }
            $price = DB::table('vehicles')->where('id', $tx->vehicle_id)->value('current_price');
            $row = [
                'payment_option' => $option, 'payment_method' => $method, 'final_price' => $price ?: null,
                'arrangement_kind' => $kind ?: null, 'location' => $kind === 'gce_visit' ? null : ($location ?: null),
                'financing_pay_method' => $payMethod,
            ];
            if ($ack) {
                $row['condition_acknowledged_at'] = now();
            }
            if ($kind === 'delivery' && $terms) {
                $row['delivery_terms_agreed_at'] = now();
            }
            if ($financing) {
                $row['requested_term_months'] = (int) $data['requested_term_months'];
            }
            if ($existing) {
                DB::table('purchase_details')->where('id', $existing->id)->update($row + ['updated_at' => now()]);
            } else {
                DB::table('purchase_details')->insert($row + ['id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'created_at' => now(), 'updated_at' => now()]);
            }

            if ($slot) {
                // Hold the new slot before releasing the old one: a lost race leaves the buyer's old slot booked.
                $live = DB::table('viewing_arrangements')->where('purchase_transaction_id', $tx->id)
                    ->whereIn('confirmation_state', ['pending', 'confirmed'])->lockForUpdate()->get(['id', 'schedule']);
                $arrangement = ['arrangement_kind' => $kind ?: 'gce_visit', 'location' => $kind === 'gce_visit' ? null : ($location ?: null), 'notes' => $data['notes'] ?? null];
                $same = $live->first(fn ($r) => CarbonImmutable::parse($r->schedule, 'UTC')->equalTo($slot));
                if ($same) {
                    DB::table('viewing_arrangements')->where('id', $same->id)->update($arrangement);
                } elseif (Trading::insertArrangement(['inquiry_id' => null, 'purchase_transaction_id' => $tx->id, 'schedule' => $slot] + $arrangement) === 'slot_taken') {
                    return 'slot_taken';
                }
                $stale = $live->pluck('id')->reject(fn ($id) => $id === $same?->id)->values();
                if ($stale->isNotEmpty()) {
                    DB::table('viewing_arrangements')->whereIn('id', $stale)->update(['confirmation_state' => 'cancelled']);
                }
            } elseif (in_array($kind, ['meetup', 'delivery'], true)) {
                DB::table('viewing_arrangements')->where('purchase_transaction_id', $tx->id)
                    ->whereIn('confirmation_state', ['pending', 'confirmed'])->update(['location' => $location ?: null]);
            }

            return null;
        });
        abort_if($result === 'slot_taken', 409, 'That visit slot is already taken. Choose another time.');

        return response()->json(['success' => true]);
    }

    /**
     * submitBuyRequest (§2 steps 3–4, §3 step 4): a GCE visit holds a locked slot; Meet Halfway, Delivery
     * and financing join the car's queue, Active if no other request is Active, otherwise On Hold.
     */
    public function submitBuyRequest(Request $request): JsonResponse
    {
        $id = $request->input('transaction_id');
        abort_unless(is_string($id) && Str::isUuid($id), 422, 'Invalid request.');
        $userId = $request->user()->id;

        $queueState = Trading::run(function () use ($request, $id, $userId) {
            $peek = $this->ownTx($request, $id);
            abort_if($peek->transaction_kind !== 'buy', 404, 'Transaction not found.');
            // Lock order: the car first, so two buyers of one car queue behind each other.
            if ($peek->vehicle_id) {
                DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first();
            }
            $tx = Trading::lockTx($id);
            abort_if($tx->current_state !== 'pending' || $tx->queue_state, 409, 'This request is already submitted.');
            $details = DB::table('purchase_details')->where('transaction_id', $id)->first();
            $needsLocation = in_array($details?->arrangement_kind, ['meetup', 'delivery'], true);
            abort_if($needsLocation && trim((string) $details?->location) === '', 422, 'Enter a location for meet-up or delivery.');
            $queued = BuyRules::isQueuedRequest($details);
            $financing = BuyRules::isFinancingRequest($details);
            $delivery = $details?->arrangement_kind === 'delivery';
            $bookedAtRequest = ! $financing || $delivery;
            abort_if(! $queued && ! BuyRules::isOnsiteCashRequest($details), 422,
                'Save Cash or Bank Transfer with GCE Visit, Meet Halfway or Delivery, or In-House Financing with GCE Visit, as the arrangement.');
            abort_if($queued && ! $details?->condition_acknowledged_at, 422, "Acknowledge the car's condition first.");
            abort_if($delivery && ! $details?->delivery_terms_agreed_at, 422, 'Agree to the delivery terms first.');

            $documents = DB::table('transaction_documents')->where('transaction_id', $id)->get(['document_kind', 'verification_state', 'id_type', 'id_side']);
            $slot = DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)
                ->whereIn('confirmation_state', ['pending', 'confirmed'])->first(['schedule', 'arrangement_kind', 'location']);
            $visitOnly = (bool) DB::table('customer_standing')->where('account_id', $userId)->value('gce_visit_only');
            abort_if($needsLocation && $slot && trim((string) $slot->location) !== trim((string) $details?->location), 422,
                'Save the location again so it matches your booked arrangement.');
            abort_unless(BuyRules::buyerIdsComplete($documents), 422, 'Upload the front and back of two valid IDs first.');
            abort_unless($documents->contains(fn ($d) => $d->document_kind === 'proof_of_billing' && $d->verification_state !== 'rejected'), 422,
                'Upload a proof of billing before sending the request.');
            abort_if($queued && $visitOnly, 422, 'Your account is limited to GCE visits.');
            $scheduledAt = $slot ? CarbonImmutable::parse($slot->schedule, 'UTC') : null;
            if ($bookedAtRequest) {
                abort_if(! $slot || $slot->arrangement_kind !== $details?->arrangement_kind, 422, 'Book the meeting time first.');
                abort_if(! $scheduledAt->isFuture(), 422, 'The booked time has passed. Pick a new one.');
                abort_unless(BuyRules::isBusinessSlot($scheduledAt), 422, BuyRules::SLOT_RULE_MESSAGE);
            }

            $review = ['current_state' => 'under_review', 'flow_status' => 'pending_sm_approval', 'review_due_at' => BuyRules::reviewDueAt()];
            $queueState = null;
            if ($queued) {
                $queueState = DB::table('transactions')->where('vehicle_id', $tx->vehicle_id)->where('queue_state', 'active')->exists() ? 'on_hold' : 'active';
                if ($queueState === 'active') {
                    try {
                        DB::transaction(fn () => Trading::updateTx($id, $review + ['queue_state' => 'active'], 'pending'));
                    } catch (UniqueConstraintViolationException $e) {
                        // Another request became Active a moment ago (one Active per car).
                        if (! Trading::isUnique($e, 'transactions_one_active_buyer_per_vehicle')) {
                            throw $e;
                        }
                        $queueState = 'on_hold';
                    }
                }
                if ($queueState === 'on_hold') {
                    // ponytail: ported as-is from submitBuyRequest; an On Hold request keeps current_state 'pending'
                    // and gets no review window until it is promoted (flagged in phase-5.md).
                    Trading::updateTx($id, ['queue_state' => 'on_hold']);
                }
            } else {
                Trading::updateTx($id, $review, 'pending');
            }

            $onHold = $queueState === 'on_hold';
            $methodLabel = $details?->payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash';
            $arrangement = $delivery ? 'Delivery' : 'Meet Halfway';
            Trading::history($id, 'pending', $onHold ? 'pending' : 'under_review', $userId, $queued
                ? 'Buyer submitted '.($financing ? 'an In-House Financing' : "a {$methodLabel} {$arrangement}").' request ('.($onHold ? 'On Hold' : 'Active').')'
                : "Buyer submitted a {$methodLabel} request with a GCE visit slot");
            // Financing is agreed in chat, so the request gets its own thread with GCE.
            if ($financing && ! DB::table('inquiries')->where('transaction_id', $id)->exists()) {
                DB::table('inquiries')->insert([
                    'id' => (string) Str::uuid(), 'customer_id' => $userId, 'vehicle_id' => $tx->vehicle_id, 'intention_kind' => 'buy_financing',
                    'transaction_id' => $id, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $when = $scheduledAt ? Trading::when($scheduledAt) : '';
            Trading::notify(['userId' => $userId], $onHold ? 'buy_request_on_hold' : 'buy_request_submitted',
                $onHold ? 'Your request is On Hold' : 'Your request was submitted',
                $onHold ? "Another buyer's request for this car is being processed. Yours stays in the queue and you will be notified."
                    : 'The Sales Manager will review your request within 7 days.', $id);
            if (! $onHold) {
                $how = $queued ? ($delivery ? 'asked for delivery' : 'asked to meet halfway') : 'booked a GCE visit';
                Trading::notify(['role' => 'sales_manager'], 'buy_request_submitted', 'New buyer request to review', $financing
                    ? 'A buyer asked for In-House Financing. Review within 7 days, then agree the payment duration.'
                    : "A Cash buyer {$how} on {$when}. Review within 7 days.", $id);
            }

            return $queueState;
        });

        return response()->json(['success' => true, 'queueState' => $queueState]);
    }

    /** respondToFinancingOffer (§6 steps 11–12): decline closes the request; proceed books the inspection visit. */
    public function respondToFinancingOffer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'decision' => ['required', 'in:proceed,decline'],
            'schedule' => ['nullable', 'string'], 'location' => ['nullable', 'string', 'max:300'],
        ], ['*' => 'Invalid response.']);
        $userId = $request->user()->id;

        $result = Trading::run(function () use ($request, $data, $userId) {
            $peek = $this->ownTx($request, $data['transaction_id']);
            abort_if($peek->transaction_kind !== 'buy', 404, 'Transaction not found.');
            if ($peek->vehicle_id) {
                DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first();
            }
            $tx = Trading::lockTx($peek->id);
            abort_if($tx->flow_status !== 'approved_awaiting_buyer_decision', 409, 'There is no financing offer to answer.');

            if ($data['decision'] === 'decline') {
                Trading::updateTx($tx->id, ['current_state' => 'cancelled', 'completed_at' => now(), 'flow_status' => null]);
                Trading::history($tx->id, $tx->current_state, 'cancelled', $userId, 'Buyer did not proceed with the approved financing');
                Trading::notify(['role' => 'sales_manager'], 'financing_declined', 'Buyer declined the financing offer',
                    'The request is closed with nothing paid. Promote the next On Hold buyer for this car.', $tx->id);

                return null;
            }

            $kind = DB::table('purchase_details')->where('transaction_id', $tx->id)->value('arrangement_kind') ?? 'gce_visit';
            $label = ['gce_visit' => 'GCE visit', 'meetup' => 'meet-up', 'delivery' => 'delivery'][$kind] ?? 'GCE visit';
            $visit = Trading::parseTime($data['schedule'] ?? null);
            abort_if(! $visit || ! BuyRules::isVisitSlot($visit), 422, $kind === 'gce_visit'
                ? 'Pick a future GCE visit slot on the hour.' : "Pick a future {$label} time. ".BuyRules::SLOT_RULE_MESSAGE);
            $location = $kind !== 'gce_visit' ? $this->saveBuyerAddress($request) : null;
            $when = Trading::when($visit);
            // A time saved before approval is replaced by this appointment.
            Trading::releaseVisitSlots($tx->id);
            if (Trading::insertArrangement([
                'inquiry_id' => null, 'purchase_transaction_id' => $tx->id, 'arrangement_kind' => $kind, 'schedule' => $visit,
                'location' => $location, 'notes' => $kind === 'delivery' ? 'Financed delivery' : 'Vehicle inspection and purchase decision appointment',
            ]) === 'slot_taken') {
                return 'slot_taken';
            }
            if ($location !== null) {
                DB::table('purchase_details')->where('transaction_id', $tx->id)->update(['location' => $location, 'updated_at' => now()]);
            }
            Trading::updateTx($tx->id, ['flow_status' => $kind === 'delivery' ? 'purchase_claim' : 'gce_visit_scheduled_dp_pending']);
            // A financed delivery is a Purchase Claim at once: the car leaves the showroom now.
            if ($kind === 'delivery') {
                Trading::reserveVehicle($tx->vehicle_id);
            }
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $userId, "Buyer accepted the financing and booked a {$label} for {$when}");
            Trading::notify(['role' => 'sales_manager'], 'financing_visit_booked', "Financing buyer booked a {$label}", $kind === 'delivery'
                ? "Delivery on {$when}. Confirm the address and set the delivery terms."
                : "Inspection and purchase decision {$label} on {$when}.", $tx->id);

            return null;
        });
        abort_if($result === 'slot_taken', 409, 'That visit slot is already taken. Choose another time.');

        return response()->json(['success' => true]);
    }

    /**
     * requestDeliveryReschedule (T10): free more than 24 hours before the original delivery, applied at once.
     * Inside 24 hours a PayMongo fee is due; that checkout is Phase 6, so it answers as before when online
     * payment is not set up.
     */
    public function requestDeliveryReschedule(Request $request): JsonResponse
    {
        $id = $request->input('transaction_id');
        abort_unless(is_string($id) && Str::isUuid($id), 404, 'Transaction not found.');
        $schedule = Trading::parseTime($request->input('schedule'));
        abort_if(! $schedule || ! $schedule->isFuture(), 422, 'Pick a future date and time.');
        abort_unless(BuyRules::isBusinessSlot($schedule), 422, BuyRules::SLOT_RULE_MESSAGE);
        $userId = $request->user()->id;

        Trading::run(function () use ($request, $id, $schedule, $userId) {
            $tx = $this->ownTx($request, $id, 'Delivery not found.', true);
            $details = DB::table('purchase_details')->where('transaction_id', $id)->lockForUpdate()->first();
            abort_if($tx->current_state !== 'approved' || $details?->arrangement_kind !== 'delivery', 404, 'Delivery not found.');
            $delivered = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'delivery')
                ->where('state', '!=', 'cancelled')->where('delivery_status', 'delivered')->exists();
            abort_if($delivered, 422, 'The car is already delivered.');
            abort_if((bool) $details->reschedule_pending_at, 422, 'A re-schedule is already waiting for its fee to be verified.');
            abort_unless(BuyRules::isDeliveryDate($schedule, CarbonImmutable::parse($tx->opened_at, 'UTC')), 422, BuyRules::DELIVERY_LEAD_MESSAGE);
            $original = BuyRules::originalDeliverySchedule(DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->get(['arrangement_kind', 'schedule', 'created_at']));
            abort_unless($original, 422, 'This delivery has no date yet.');
            $fee = BuyRules::rescheduleFee(CarbonImmutable::parse($original, 'UTC'), (float) ($details->delivery_fee ?? 0));
            abort_if($fee > 0 && $request->input('acknowledge_fee') !== 'yes', 422, 'Acknowledge the re-scheduling fee first.');
            // Phase 6 owns the PayMongo checkout for the fee.
            abort_if($fee > 0, 422, 'Online payment is not set up yet.');
            $location = $this->saveBuyerAddress($request);
            Trading::applyDeliveryReschedule($tx, $schedule, $location, 0, $userId);
        });

        return response()->json(['success' => true]);
    }

    /** signContract (T06): typed name plus drawn signature, or face-to-face at GCE. */
    public function signContract(Request $request): JsonResponse
    {
        $id = $request->input('transaction_id');
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $id, $userId) {
            $tx = $this->ownTx($request, $id, lock: true);
            abort_if($tx->current_state !== 'approved', 404, 'Transaction not found.');
            $handover = DB::table('sale_handovers')->where('transaction_id', $tx->id)->lockForUpdate()->first();
            abort_if($handover?->contract_state === 'signed', 409, 'The contract is already signed.');
            abort_if($handover?->contract_state !== 'approved', 422, 'The contract is not approved yet.');
            if ($request->input('signing_method') === 'face_to_face') {
                DB::table('sale_handovers')->where('transaction_id', $tx->id)->update(['signing_method' => 'face_to_face']);
                Trading::notify(['role' => 'sales_manager'], 'contract_face_to_face', 'Buyer will sign face-to-face',
                    'The buyer chose to sign the contract in person. Mark it signed once they do.', $tx->id);

                return;
            }
            $name = trim((string) $request->input('signed_name'));
            abort_if($name === '', 422, 'Type your full name to sign.');
            $signature = (string) $request->input('signature_path');
            abort_unless(str_starts_with($signature, "{$tx->id}/signature-") && app(FileService::class)->exists(self::BUCKET, $signature), 422, 'Draw your signature to sign.');
            DB::table('sale_handovers')->where('transaction_id', $tx->id)->update([
                'contract_state' => 'signed', 'contract_signed_at' => now(), 'signing_method' => 'e_signature', 'signature_path' => $signature,
            ]);
            Trading::history($tx->id, $tx->current_state, $tx->current_state, $userId, "Contract signed by {$name}");
            Trading::notify(['role' => 'sales_manager'], 'contract_signed', 'Contract signed by the buyer', "{$name} signed the contract.", $tx->id);
        });

        return response()->json(['success' => true]);
    }

    /**
     * cancelTransaction. Ports guard_transaction_end's 5-hour rule for every customer cancel (Supabase
     * skipped it for service-role writes), and opens a recovery case for an active financing.
     */
    public function cancelTransaction(Request $request): JsonResponse
    {
        $id = $request->input('id');
        $reason = $request->input('reason') ?: null;
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $id, $reason, $userId) {
            $peek = $this->ownTx($request, $id, 'Transaction not found');
            if ($peek->vehicle_id) {
                DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first();
            }
            $tx = Trading::lockTx($peek->id);
            abort_if(in_array($tx->current_state, Trading::TERMINAL, true), 409, 'This transaction can no longer be cancelled.');
            $delivered = DB::table('field_cases')->where('transaction_id', $tx->id)->where('case_kind', 'delivery')
                ->where('delivery_status', 'delivered')->where('state', '!=', 'cancelled')->first(['id', 'assigned_confidential_informant', 'head_security_id']);
            $termsState = DB::table('payment_terms')->where('purchase_transaction_id', $tx->id)->value('state');
            $method = DB::table('purchase_details')->where('transaction_id', $tx->id)->value('payment_method');
            $recovery = $termsState === 'active' || $tx->flow_status === 'financing_active' || ($method === 'financing' && $delivered);
            abort_if($recovery && $request->input('towing_ack') !== 'yes', 422, 'Agree that GCE will tow and take back the car before cancelling.');
            $scheduled = DB::table('viewing_arrangements')->where('purchase_transaction_id', $tx->id)
                ->whereIn('arrangement_kind', ['meetup', 'delivery'])->whereIn('confirmation_state', ['pending', 'confirmed'])->pluck('schedule');
            abort_if(! $recovery && $scheduled->contains(fn ($at) => ! BuyRules::canCancelScheduled(CarbonImmutable::parse($at, 'UTC'))), 422,
                'Cancellation is only allowed 5 hours or more before the scheduled time.');
            if ($recovery) {
                DB::table('purchase_details')->where('transaction_id', $tx->id)
                    ->update(['cancellation_towing_ack_at' => now(), 'cancellation_towing_ack_by' => $userId, 'updated_at' => now()]);
            }
            Trading::updateTx($tx->id, ['current_state' => 'cancelled', 'completed_at' => now()], $tx->current_state);
            Trading::history($tx->id, $tx->current_state, 'cancelled', $userId, $recovery
                ? 'Customer agreed to towing and recovery. '.($reason ?? 'Cancelled active financing') : ($reason ?? 'Cancelled by customer'));
            if ($recovery) {
                // T07 CR1: cancelling opens a recovery case; only the CI's hand-over repossesses the car.
                $open = DB::table('field_cases')->where('transaction_id', $tx->id)->where('case_kind', 'recovery')
                    ->whereIn('state', ['assigned', 'accepted', 'in_progress'])->exists();
                if (! $open) {
                    DB::table('field_cases')->insert([
                        'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'vehicle_id' => $tx->vehicle_id, 'case_kind' => 'recovery', 'state' => 'assigned',
                        'assigned_confidential_informant' => $delivered?->assigned_confidential_informant, 'head_security_id' => $delivered?->head_security_id,
                        'notes' => 'Client cancelled active financing and agreed that GCE must tow and take back the car.',
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
                foreach (['head_accountant', 'confidential_informant', 'head_security'] as $role) {
                    Trading::notify(['role' => $role], 'financing_cancelled_recovery', 'Financing cancelled: car recovery required',
                        'Client agreed to towing. Arrange recovery of the car and reconditioning.', $tx->id);
                }
            }
            Trading::releaseVisitSlots($tx->id);
        });

        return response()->json(['success' => true]);
    }

    /** submitReview: one review per completed transaction. */
    public function submitReview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_id' => ['required', 'uuid'], 'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'body' => ['required', 'string', 'max:2000'],
        ], ['body.required' => 'Write your review.', 'body.max' => 'Keep your review within 2000 characters.', '*' => 'Invalid review.']);
        $body = trim($data['body']);
        abort_if($body === '', 422, 'Write your review.');
        $tx = $this->ownTx($request, $data['transaction_id']);
        abort_if($tx->current_state !== 'completed', 422, 'Complete the transaction before reviewing GCE.');
        try {
            DB::table('customer_reviews')->insert([
                'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'customer_id' => $request->user()->id, 'vehicle_id' => $tx->vehicle_id,
                'rating' => (int) $data['rating'], 'body' => $body, 'created_at' => now(), 'updated_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            abort(409, 'You already reviewed this transaction.');
        }

        return response()->json(['success' => true]);
    }
}
