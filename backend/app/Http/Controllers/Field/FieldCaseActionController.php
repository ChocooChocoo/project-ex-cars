<?php

namespace App\Http\Controllers\Field;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Trading\DeliveryController;
use App\Models\VehicleInspection;
use App\Services\FileService;
use App\Services\Finance\Money;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Field team steps (was src/app/(staff)/field-cases/{actions,delivery-actions,location-actions,recovery-actions,
 * sell-inspection-actions}.ts). Every step checks that the caller is named on the case (or oversees it).
 */
class FieldCaseActionController extends Controller
{
    private const DELIVERY_LABELS = ['dispatched' => 'Dispatched', 'in_transit' => 'In Transit', 'arriving' => 'Arriving', 'delivered' => 'Delivered'];

    private function role(Request $request): string
    {
        return (string) $request->user()->role()?->value;
    }

    private static function isAssigned(object $case, string $userId): bool
    {
        return in_array($userId, [$case->assigned_confidential_informant, $case->mechanic_id, $case->head_security_id], true);
    }

    private function lockCase(mixed $id, string $invalid = 'Invalid field case.'): object
    {
        abort_unless(is_string($id) && Str::isUuid($id), 422, $invalid);
        $case = DB::table('field_cases')->where('id', $id)->lockForUpdate()->first();
        abort_unless($case, 404, 'Field case not found.');

        return $case;
    }

    /** access.ts assignedCase: the CI or Mechanic named on an open case. */
    private function assignedCase(Request $request, mixed $id): object
    {
        $case = $this->lockCase($id);
        $role = $this->role($request);
        $userId = $request->user()->id;
        $assigned = ($role === 'confidential_informant' && $case->assigned_confidential_informant === $userId) || ($role === 'mechanic' && $case->mechanic_id === $userId);
        abort_unless($assigned, 403, 'Only the assigned field team can update this case.');
        abort_if(in_array($case->state, ['completed', 'cancelled'], true), 409, 'This field case is closed.');

        return $case;
    }

    /**
     * The states a field worker may pick for a case. `assigned` comes from the creation dialog and `accepted` is
     * stamped automatically when the worker first updates the case (SN-5), so neither is a choice here.
     */
    public const WORKER_STATES = ['in_progress', 'completed', 'cancelled'];

    /** The expenses column is the sum of the filed rows (SN-6), in centavos. */
    private static function expensesCents(string $caseId): int
    {
        return Money::sum(DB::table('field_case_expenses')->where('field_case_id', $caseId)->get(['amount']));
    }

    /** SN-8: only a seller meet-up at a halfway point has to file (or deny) the travel expenses. */
    private static function needsExpenses(object $case): bool
    {
        return $case->case_kind === 'acquisition' && $case->transaction_id
            && DB::table('sell_details')->where('transaction_id', $case->transaction_id)->value('meetup_method') === 'meet_halfway';
    }

    /** updateFieldCase: overseers act on any case; field workers on their own. */
    public function updateFieldCase(Request $request): JsonResponse
    {
        $role = $this->role($request);
        abort_unless(in_array($role, ['ceo', 'confidential_informant', 'mechanic', 'sales_manager'], true), 403, 'Not authorized to update field cases');
        $data = $request->validate([
            'field_case_id' => ['required', 'uuid'], 'state' => ['nullable', 'in:assigned,accepted,in_progress,completed,cancelled'],
            'no_expenses' => ['nullable', 'boolean'], 'notes' => ['nullable', 'string', 'max:1000'],
        ], ['*' => 'Invalid field case update.']);
        $state = $data['state'] ?? null;
        $noExpenses = $request->boolean('no_expenses');
        abort_if($state === null && ! $noExpenses && ! $request->has('notes'), 422, 'Invalid field case update.');
        $userId = $request->user()->id;
        $overseer = in_array($role, ['ceo', 'sales_manager'], true);
        Trading::run(function () use ($request, $data, $state, $noExpenses, $role, $overseer, $userId) {
            $case = $this->lockCase($data['field_case_id']);
            if (! $overseer) {
                abort_unless(self::isAssigned($case, $userId), 403, 'Only the assigned field team can update this case.');
                // SN-5: a field worker drives a case forward, never back to Assigned or Accepted.
                abort_if($state !== null && ! in_array($state, self::WORKER_STATES, true), 422, 'A field worker can only set In progress, Completed or Cancelled.');
            }
            $update = ['updated_at' => now()];
            if ($state !== null) {
                $update['state'] = $state;
            }
            $filedExpenses = DB::table('field_case_expenses')->where('field_case_id', $case->id)->exists();
            if ($noExpenses) {
                // SN-8: the honest "this trip cost nothing" answer, instead of an invented zero-value expense row.
                abort_unless($case->assigned_confidential_informant === $userId, 403, 'The assigned Confidential Informant confirms the trip costs nothing.');
                abort_unless(self::needsExpenses($case), 422, 'Only a Meet Halfway seller meet-up records travel expenses.');
                abort_if($filedExpenses, 422, 'This case already has filed expenses.');
                $update['no_expenses_at'] = now();
            }
            if ($state === 'completed') {
                // Selling step 11 (SN-8): a Meet Halfway seller meet-up closes once its expenses are filed or denied.
                if (self::needsExpenses($case)) {
                    abort_unless($filedExpenses || $noExpenses || $case->no_expenses_at !== null, 422,
                        'File the meet-up expenses with proofs before completing this case.');
                }
                $update['completion_date'] = now();
            }
            // SN-5: opening or updating a case is accepting the assignment; no worker needs to pick "Accepted".
            if ($case->accepted_at === null && in_array($role, ['confidential_informant', 'mechanic'], true)) {
                $update['accepted_at'] = now();
            }
            if ($state === 'accepted' && ! $request->filled('accepted_at')) {
                $update['accepted_at'] = now();
            }
            // SN-6: the total is the sum of the itemised expenses; the client never sends it.
            $update['expenses_cents'] = $filedExpenses ? self::expensesCents($case->id) : 0;
            if ($request->has('notes')) {
                $update['notes'] = ($data['notes'] ?? null) ?: null;
            }
            DB::table('field_cases')->where('id', $case->id)->update($update);
        });

        return response()->json(['success' => true]);
    }

    // ---- Delivery ---------------------------------------------------------------------------------

    /** assignedDelivery: the CI or Head Security named on an open delivery of an approved sale. */
    private function assignedDelivery(Request $request, mixed $id): object
    {
        abort_unless(is_string($id) && Str::isUuid($id), 422, 'Invalid field case.');
        $peek = DB::table('field_cases')->where('id', $id)->first(['transaction_id']);
        if ($peek?->transaction_id) {
            Trading::lockTx($peek->transaction_id);
        }
        $case = DB::table('field_cases')->where('id', $id)->lockForUpdate()->first();
        abort_if($case?->case_kind !== 'delivery' || ! $case->transaction_id, 404, 'Delivery not found.');
        abort_unless(in_array($this->role($request), ['confidential_informant', 'head_security'], true) && self::isAssigned($case, $request->user()->id), 403,
            'Only the assigned delivery team can update this delivery.');
        abort_if(in_array($case->state, ['completed', 'cancelled'], true), 409, 'This delivery is closed.');
        abort_if(DB::table('transactions')->where('id', $case->transaction_id)->value('current_state') !== 'approved', 409, 'This delivery is no longer active.');

        return $case;
    }

    /** advanceDeliveryStatus (§4 steps 6–7a). */
    public function advanceDeliveryStatus(Request $request): JsonResponse
    {
        Trading::run(function () use ($request) {
            $case = $this->assignedDelivery($request, $request->input('field_case_id'));
            $next = BuyRules::nextDeliveryStatus($case->delivery_status);
            abort_unless($next, 409, 'The car is already delivered.');
            $tx = DB::table('transactions')->where('id', $case->transaction_id)->first();
            $details = DB::table('purchase_details')->where('transaction_id', $tx->id)->first();
            $payments = DB::table('payment_records')->where('transaction_id', $tx->id)->get(['payment_kind', 'amount', 'verified_by', 'rejected_at']);
            if ($next === 'dispatched') {
                abort_if(! $details?->downpayment_amount || BuyRules::verifiedPaid($payments, 'downpayment') < (float) $details->downpayment_amount, 422,
                    'Wait for the Head Accountant to confirm the downpayment before dispatch.');
                abort_if(DB::table('sale_handovers')->where('transaction_id', $tx->id)->value('papers_status') !== 'released_to_ci', 422,
                    'The Confidential Informant must record the vehicle papers as released before dispatch.');
            }
            abort_if($next === 'delivered' && $details?->payment_method === 'bank_transfer' && BuyRules::verifiedTowardPrice($payments) < (float) ($details->final_price ?? 0), 422,
                "Wait for the Head Accountant to verify the buyer's bank transfer before marking it delivered.");
            DB::table('field_cases')->where('id', $case->id)->update(['delivery_status' => $next, 'state' => $next === 'delivered' ? 'completed' : 'in_progress', 'updated_at' => now()]
                + ($next === 'delivered' ? ['completion_date' => now()] : []));
            Trading::notify(['userId' => $tx->customer_id], 'delivery_status', 'Delivery: '.self::DELIVERY_LABELS[$next], $next === 'delivered'
                ? 'Your car has arrived. Inspect it before you accept it. '.DeliveryController::balanceNote($details?->payment_method, 'buyer')
                : 'Your delivery is now '.strtolower(self::DELIVERY_LABELS[$next]).'.', $tx->id);
            if ($next === 'delivered') {
                Trading::notify(['role' => 'sales_manager'], 'delivery_status', 'Car delivered', 'The delivery team reached the buyer. Record the outcome: balance received, declined or unavailable.', $tx->id);
            }
        });

        return response()->json(['success' => true]);
    }

    /** reportDeliveryDelay (§4 step 7b). */
    public function reportDeliveryDelay(Request $request): JsonResponse
    {
        Trading::run(function () use ($request) {
            $case = $this->assignedDelivery($request, $request->input('field_case_id'));
            abort_if($this->role($request) !== 'confidential_informant', 403, 'The Confidential Informant reports delays.');
            $note = trim((string) $request->input('delay_note'));
            abort_if($note === '', 422, 'Describe the delay.');
            abort_if(mb_strlen($note) > 500, 422, 'Invalid delay report.');
            $eta = null;
            if ($request->filled('expected_arrival')) {
                $eta = Trading::parseTime($request->input('expected_arrival'));
                abort_unless($eta, 422, 'Enter a valid expected arrival time.');
                // SH-12: an expected arrival in the past tells the buyer nothing useful.
                abort_unless(BuyRules::isFutureSchedule($eta), 422, 'Set a future expected arrival.');
            }
            DB::table('field_cases')->where('id', $case->id)->update(['delay_note' => $note, 'expected_arrival' => $eta, 'updated_at' => now()]);
            Trading::notify(['role' => 'sales_manager'], 'delivery_delay_reported', 'Delivery delay reported', "{$note}. Tell the buyer from the transaction page.", $case->transaction_id);
        });

        return response()->json(['success' => true]);
    }

    /** receiveFieldCase: the assigned CI and Mechanic each acknowledge a meet-up or delivery. */
    public function receiveFieldCase(Request $request): JsonResponse
    {
        $role = $this->role($request);
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $role, $userId) {
            $case = $this->lockCase($request->input('field_case_id'));
            abort_if(! $case->transaction_id || ! in_array($case->case_kind, ['buyer_meetup', 'delivery'], true), 404, 'Field case not found.');
            $column = $role === 'confidential_informant' && $case->assigned_confidential_informant === $userId ? 'ci_received_at'
                : ($role === 'mechanic' && $case->mechanic_id === $userId ? 'mechanic_received_at' : null);
            abort_unless($column, 403, 'Only the team assigned to this field case can receive it.');
            abort_if(in_array($case->state, ['completed', 'cancelled'], true), 409, 'This field case is closed.');
            DB::table('field_cases')->where('id', $case->id)->update([$column => now(), 'updated_at' => now()]);
        });

        return response()->json(['success' => true]);
    }

    private static function validLatLng(mixed $lat, mixed $lng): bool
    {
        return is_numeric($lat) && is_numeric($lng) && is_finite((float) $lat) && is_finite((float) $lng) && abs((float) $lat) <= 90 && abs((float) $lng) <= 180;
    }

    /** updateDeliveryLocation (T03 D1): only while in transit or arriving. */
    public function updateDeliveryLocation(Request $request): JsonResponse
    {
        Trading::run(function () use ($request) {
            $case = $this->assignedDelivery($request, $request->input('field_case_id'));
            abort_unless(in_array($case->delivery_status, ['in_transit', 'arriving'], true), 422, 'Location is shared only while the car is in transit or arriving.');
            abort_unless(self::validLatLng($request->input('lat'), $request->input('lng')), 422, 'Invalid location.');
            DB::table('field_cases')->where('id', $case->id)->update(['last_lat' => (float) $request->input('lat'), 'last_lng' => (float) $request->input('lng'), 'last_located_at' => now()]);
        });

        return response()->json(['success' => true]);
    }

    /** getFieldCaseLocation: the buyer, the named team and the office roles may read the last position. */
    public function location(Request $request, string $id): JsonResponse
    {
        abort_unless(Str::isUuid($id), 422, 'Invalid case.');
        $case = DB::table('field_cases')->where('id', $id)->first();
        abort_unless($case, 404, 'Case not found.');
        $userId = $request->user()->id;
        $role = $this->role($request);
        $allowed = self::isAssigned($case, $userId)
            || ($role === 'customer' && $case->transaction_id && DB::table('transactions')->where('id', $case->transaction_id)->value('customer_id') === $userId)
            || in_array($role, ['ceo', 'head_accountant', 'sales_manager', 'marketing_specialist'], true);
        abort_unless($allowed, 403, 'Not authorized to view this location.');

        return response()->json([
            'success' => true, 'lat' => $case->last_lat === null ? null : (float) $case->last_lat, 'lng' => $case->last_lng === null ? null : (float) $case->last_lng,
            'at' => $case->last_located_at ? \Carbon\CarbonImmutable::parse($case->last_located_at, 'UTC')->toJSON() : null,
        ]);
    }

    // ---- Recovery ---------------------------------------------------------------------------------

    private function assignedRecovery(Request $request, mixed $id): object
    {
        abort_unless(is_string($id) && Str::isUuid($id), 422, 'Invalid recovery case.');
        $case = DB::table('field_cases')->where('id', $id)->lockForUpdate()->first();
        $column = ['confidential_informant' => 'assigned_confidential_informant', 'head_security' => 'head_security_id', 'mechanic' => 'mechanic_id'][$this->role($request)] ?? null;
        abort_if($case?->case_kind !== 'recovery' || ! $column || $case->{$column} !== $request->user()->id, 403, 'Only the assigned recovery team can act on this case.');
        abort_if(in_array($case->state, ['completed', 'cancelled'], true), 409, 'This recovery case is closed.');

        return $case;
    }

    /** advanceRecovery: assigned → accepted → in progress → completed (the CI hands the car to a Mechanic). */
    public function advanceRecovery(Request $request): JsonResponse
    {
        $role = $this->role($request);
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $role, $userId) {
            $peek = DB::table('field_cases')->where('id', $request->input('field_case_id'))->value('transaction_id');
            $vehicleId = $peek ? DB::table('transactions')->where('id', $peek)->value('vehicle_id') : null;
            if ($vehicleId) {
                DB::table('vehicles')->where('id', $vehicleId)->lockForUpdate()->first();
            }
            if ($peek) {
                Trading::lockTx($peek);
            }
            $case = $this->assignedRecovery($request, $request->input('field_case_id'));
            $next = $request->input('state');
            $expected = $case->state === 'assigned' ? 'accepted' : ($case->state === 'accepted' ? 'in_progress' : 'completed');
            abort_if($next !== $expected, 409, 'Refresh this case before changing its status.');
            $mechanicId = null;
            if ($next === 'completed') {
                abort_if($role !== 'confidential_informant', 403, 'The assigned Confidential Informant must hand over the recovered car.');
                $mechanicId = $request->input('mechanic_id');
                abort_unless(Str::isUuid((string) $mechanicId), 422, 'Choose an available mechanic.');
                abort_unless(Trading::isWorker($mechanicId, 'mechanic'), 422, 'The selected user is not an active mechanic.');
                abort_unless($vehicleId, 422, 'Recovery vehicle not found.');
                $open = DB::table('reconditioning_jobs')->where('vehicle_id', $vehicleId)->where('state', '!=', 'completed')->lockForUpdate()->first(['id']);
                if ($open) {
                    DB::table('reconditioning_jobs')->where('id', $open->id)->update(['mechanic_id' => $mechanicId]);
                } else {
                    DB::table('reconditioning_jobs')->insert(['id' => (string) Str::uuid(), 'vehicle_id' => $vehicleId, 'transaction_id' => $case->transaction_id, 'mechanic_id' => $mechanicId, 'created_at' => now()]);
                }
                DB::table('vehicles')->where('id', $vehicleId)->update(['listing_state' => 'repairing', 'updated_at' => now()]);
                DB::table('installment_accounts')->where('purchase_transaction_id', $case->transaction_id)->update(['state' => 'repossessed', 'updated_at' => now()]);
                Trading::updateTx($case->transaction_id, ['flow_status' => 'repossessed']);
                Trading::notify(['userId' => $mechanicId], 'reconditioning', 'Recovered car handed over', 'Inspect the recovered car and submit a per-part repair estimate.', $vehicleId, 'vehicles');
            }
            $updated = DB::table('field_cases')->where('id', $case->id)->where('state', $case->state)->update([
                'state' => $next, 'notes' => ($case->notes ?? '')."\n".mb_substr((string) $request->input('notes', ''), 0, 4000), 'updated_at' => now(),
            ] + ($mechanicId ? ['mechanic_id' => $mechanicId, 'completion_date' => now()] : []) + ($next === 'accepted' ? ['accepted_at' => now()] : []));
            abort_unless($updated, 409, 'Refresh this case before changing its status.');
            Trading::audit($userId, 'recovery_status', 'field_cases', $case->id, "Recovery {$next}");
        });

        return response()->json(['success' => true]);
    }

    /** uploadTowEvidence: a tow photo into the transaction's folder. */
    public function uploadTowEvidence(Request $request, FileService $files): JsonResponse
    {
        $file = $request->file('file');
        abort_if(! $file || ! $file->getSize() || $file->getSize() > FileService::MAX_BYTES
            || ! in_array((new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath()), ['image/jpeg', 'image/png', 'image/webp'], true), 422,
            'Choose a JPEG, PNG or WebP photo of 2 MB or smaller.');
        $stored = null;
        try {
            Trading::run(function () use ($request, $files, $file, &$stored) {
                $case = $this->assignedRecovery($request, $request->input('field_case_id'));
                $stored = $files->store($file, 'transaction-documents', (string) $case->transaction_id);
                DB::table('transaction_documents')->insert([
                    'id' => (string) Str::uuid(), 'transaction_id' => $case->transaction_id, 'document_kind' => 'inspection_photo', 'storage_path' => $stored['path'],
                    'uploader_id' => $request->user()->id, 'verification_state' => 'verified', 'upload_date' => now(),
                ]);
            });
        } catch (\Throwable $e) {
            $files->delete('transaction-documents', $stored['path'] ?? null);
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    public function updateRecoveryLocation(Request $request): JsonResponse
    {
        Trading::run(function () use ($request) {
            $case = $this->assignedRecovery($request, $request->input('field_case_id'));
            abort_if($case->state !== 'in_progress', 422, 'Share location only while towing is in progress.');
            abort_unless(self::validLatLng($request->input('lat'), $request->input('lng')), 422, 'Invalid location.');
            DB::table('field_cases')->where('id', $case->id)->update(['last_lat' => (float) $request->input('lat'), 'last_lng' => (float) $request->input('lng'), 'last_located_at' => now()]);
        });

        return response()->json(['success' => true]);
    }

    // ---- Seller meet-up (acquisition) -------------------------------------------------------------

    /** @param  list<UploadedFile>  $uploads */
    private static function fileError(array $uploads, bool $allowPdf): ?string
    {
        foreach ($uploads as $file) {
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
            if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], true) || (! $allowPdf && $mime === 'application/pdf')) {
                return $allowPdf ? 'Files must be JPEG, PNG, WebP or PDF.' : 'Photos must be JPEG, PNG or WebP images.';
            }
            if ($file->getSize() > FileService::MAX_BYTES) {
                return 'Each file must be 2 MB or smaller.';
            }
        }

        return null;
    }

    /** @return list<UploadedFile> */
    private static function files(Request $request, string $key): array
    {
        $value = $request->file($key);
        // Flatten fully: a repeated key arrives as `key[]`, but a browser or client that already sent
        // `key[][]` must not silently lose its photos (the inspection then looked unphoto'd).
        $flat = is_array($value) ? Arr::flatten($value) : ($value ? [$value] : []);

        return array_values(array_filter($flat, fn ($f) => $f instanceof UploadedFile && $f->getSize() > 0));
    }

    /** confirmFieldCheck (selling step 6). */
    public function confirmFieldCheck(Request $request): JsonResponse
    {
        $role = $this->role($request);
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $role, $userId) {
            $case = $this->assignedCase($request, $request->input('field_case_id'));
            $check = $request->input('check');
            $identityRole = $case->assigned_confidential_informant ? 'confidential_informant' : 'mechanic';
            abort_if($check === 'identity' && $role !== $identityRole, 403, "The Confidential Informant confirms the seller's identity.");
            abort_if($check === 'plate' && $role !== 'mechanic', 403, 'The Mechanic confirms the plate and chassis.');
            abort_unless(in_array($check, ['identity', 'plate'], true), 422, 'Invalid check.');
            DB::table('field_cases')->where('id', $case->id)->update(($check === 'identity'
                ? ['identity_confirmed_at' => now(), 'identity_confirmed_by' => $userId]
                : ['plate_confirmed_at' => now(), 'plate_confirmed_by' => $userId]) + ['updated_at' => now()]);
        });

        return response()->json(['success' => true]);
    }

    /** $request's JSON list of inspection answers, normalised and refused unless every leaf part is answered. */
    private function inspectionAnswers(Request $request): array
    {
        $raw = $request->input('results');
        abort_unless(is_string($raw) && trim($raw) !== '', 422, 'Answer every part of the checklist before reporting the inspection.');
        $rows = json_decode($raw, true);
        abort_unless(is_array($rows) && $rows !== [] && count($rows) <= 500, 422, 'Invalid inspection report.');
        $answers = [];
        foreach ($rows as $row) {
            abort_unless(is_array($row), 422, 'Invalid inspection report.');
            $nodeId = $row['node_id'] ?? null;
            abort_unless(is_string($nodeId) && Str::isUuid($nodeId), 422, 'Answer every part of the checklist before reporting the inspection.');
            abort_if(isset($answers[$nodeId]), 422, 'Answer each part of the checklist once.');
            $status = $row['status'] ?? null;
            abort_unless(in_array($status, VehicleInspection::PART_STATUSES, true), 422, 'Answer every part of the checklist before reporting the inspection.');
            $cost = $row['cost'] ?? null;
            if ($status === 'for_repair') {
                abort_unless(is_numeric($cost) && (float) $cost >= 0, 422, 'Give the repair cost of every part that needs repair.');
            }
            $note = trim((string) ($row['note'] ?? ''));
            abort_if(mb_strlen($note) > 500, 422, 'Invalid inspection note.');
            $answers[$nodeId] = ['status' => $status, 'cost' => $status === 'for_repair' ? Money::decimal(Money::cents($cost)) : null, 'note' => $note !== '' ? $note : null];
        }
        $leaf = array_map(fn ($node) => $node->id, VehicleInspection::leafNodes(VehicleInspection::checklistNodes()));
        abort_if($leaf === [], 422, 'No checklist parts are defined yet.');
        abort_unless(count(array_diff($leaf, array_keys($answers))) === 0, 422, 'Answer every part of the checklist before reporting the inspection.');
        abort_unless(count(array_diff(array_keys($answers), $leaf)) === 0, 422, 'Invalid inspection report.');

        return [$answers, $leaf];
    }

    /**
     * reportInspection (selling step 6, SH-7): a part-by-part checklist. No issue clears the car for payment; any
     * `for_repair` part goes to the Marketing Specialist with its cost, note and photos. `inspection_outcome`,
     * `issue_description` and `repair_estimate` are still derived on the case so the older readers keep working.
     */
    public function reportInspection(Request $request, FileService $files): JsonResponse
    {
        [$answers, $leaf] = $this->inspectionAnswers($request);
        $photosByNode = [];
        $stored = [];
        try {
            Trading::run(function () use ($request, $files, $answers, $leaf, &$photosByNode, &$stored) {
                $case = $this->assignedCase($request, $request->input('field_case_id'));
                abort_if($this->role($request) !== 'mechanic', 403, 'The Mechanic reports the inspection.');
                abort_if($case->case_kind !== 'acquisition' || ! $case->transaction_id, 422, 'Only seller meet-up cases have an inspection report.');
                abort_if((bool) $case->inspection_outcome, 409, 'The inspection is already reported.');
                abort_if(! $case->identity_confirmed_at || ! $case->plate_confirmed_at, 422, "Confirm the seller's identity and the plate/chassis before reporting the inspection.");
                $vehicleId = $case->vehicle_id ?: DB::table('transactions')->where('id', $case->transaction_id)->value('vehicle_id');
                abort_unless($vehicleId, 422, 'This case has no vehicle to inspect.');
                // Photos arrive as `result_photo_{node id}` (PHP keeps only the last repeated key, so the browser
                // sends `result_photo_{node id}[]`), and each part says which ones are its own.
                $total = 0;
                foreach ($leaf as $nodeId) {
                    $nodePhotos = self::files($request, "result_photo_{$nodeId}");
                    abort_if($answers[$nodeId]['status'] === 'for_repair' && count($nodePhotos) === 0, 422,
                        'Attach at least one photo of every part that needs repair.');
                    abort_if(count($nodePhotos) > 6, 422, 'Attach at most 6 photos of a part.');
                    $error = self::fileError($nodePhotos, false);
                    abort_if($error !== null, 422, (string) $error);
                    $photosByNode[$nodeId] = $nodePhotos;
                }
                // SH-7: the seller ticked these parts on the sell form; anything else marked for repair is hidden.
                $declared = collect(json_decode((string) DB::table('sell_details')->where('transaction_id', $case->transaction_id)->value('condition_items'), true) ?: [])
                    ->filter(fn ($id) => is_string($id))->values()->all();
                $userId = $request->user()->id;
                $inspectionId = (string) Str::uuid();
                DB::table('vehicle_inspections')->insert([
                    'id' => $inspectionId, 'vehicle_id' => $vehicleId, 'mechanic_id' => $userId, 'field_case_id' => $case->id,
                    'inspection_date' => now(), 'created_at' => now(),
                ]);
                $issueLines = [];
                foreach ($leaf as $nodeId) {
                    $answer = $answers[$nodeId];
                    $forRepair = $answer['status'] === 'for_repair';
                    $hidden = $forRepair && ! in_array($nodeId, $declared, true);
                    DB::table('inspection_checklist_results')->insert([
                        'id' => (string) Str::uuid(), 'inspection_id' => $inspectionId, 'checklist_entry_id' => $nodeId,
                        'status' => $answer['status'], 'notes' => $answer['note'], 'repair_cost' => $answer['cost'],
                        'is_hidden_issue' => $hidden, 'answered_at' => now(),
                    ]);
                    if (! $forRepair) {
                        continue;
                    }
                    $total += Money::cents($answer['cost']);
                    $name = (string) DB::table('inspection_checklist_nodes')->where('id', $nodeId)->value('name');
                    $issueLines[] = trim($name).' ('.Money::currency(Money::cents($answer['cost'])).')'.($answer['note'] ? ": {$answer['note']}" : '');
                    foreach ($photosByNode[$nodeId] as $photo) {
                        $stored[] = $path = $files->store($photo, 'transaction-documents', $case->transaction_id)['path'];
                        DB::table('transaction_documents')->insert([
                            'id' => (string) Str::uuid(), 'transaction_id' => $case->transaction_id, 'document_kind' => 'inspection_photo',
                            'storage_path' => $path, 'note' => $nodeId, 'uploader_id' => $userId, 'verification_state' => 'verified', 'upload_date' => now(),
                        ]);
                    }
                }
                $issue = $issueLines !== [];
                $description = $issue ? mb_substr(implode('; ', $issueLines), 0, 2000) : null;
                DB::table('vehicle_inspections')->where('id', $inspectionId)->update(['findings' => $description ?? 'No issues found on the submitted checklist.']);
                DB::table('field_cases')->where('id', $case->id)->update([
                    'inspection_outcome' => $issue ? 'issue_found' : 'no_issues', 'issue_description' => $description,
                    'repair_estimate' => $issue ? Money::decimal($total) : null, 'inspected_at' => now(), 'state' => 'in_progress', 'updated_at' => now(),
                ]);
                if (! $issue) {
                    DB::table('sell_details')->where('transaction_id', $case->transaction_id)->update(['cleared_for_payment_at' => now(), 'updated_at' => now()]);
                }
                foreach ($issue ? ['marketing_specialist'] : ['marketing_specialist', 'account_manager', 'ceo'] as $role) {
                    Trading::notify(['role' => $role], $issue ? 'inspection_issue_found' : 'sell_ready_for_payment',
                        $issue ? 'Inspection found an issue' : "Seller's car cleared for payment", $issue
                        ? 'The Mechanic found an issue at the seller meet-up. Create the Inspection Issue Report.'
                        : 'The inspection found no issues. The fund requester can now pay the seller from the released funds.', $case->transaction_id);
                }
            });
        } catch (\Throwable $e) {
            foreach ($stored as $path) {
                $files->delete('transaction-documents', $path);
            }
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /**
     * fileFieldExpense (selling steps 11–12, SH-9): only the Confidential Informant files meet-up expenses with
     * their proof — the Mechanic's view of them is read-only. SN-6: the case's expenses total is the filed sum.
     */
    public function fileFieldExpense(Request $request, FileService $files): JsonResponse
    {
        abort_unless($this->role($request) === 'confidential_informant', 403, 'Only the Confidential Informant files meet-up expenses.');
        $data = $request->validate(['amount' => ['required', 'numeric', 'min:0'], 'description' => ['required', 'string', 'max:500']],
            ['amount.min' => 'Amount cannot be negative.', 'description.required' => 'Describe the expense.', '*' => 'Invalid expense.']);
        $description = trim($data['description']);
        abort_if($description === '', 422, 'Describe the expense.');
        $proof = self::files($request, 'proof')[0] ?? null;
        abort_unless($proof, 422, 'Attach the proof of expense.');
        $error = self::fileError([$proof], true);
        abort_if($error !== null, 422, (string) $error);
        $stored = null;
        try {
            Trading::run(function () use ($request, $files, $data, $description, $proof, &$stored) {
                $case = $this->assignedCase($request, $request->input('field_case_id'));
                abort_unless($case->transaction_id, 422, 'Expenses can only be filed on a case linked to a transaction.');
                // SN-8: filing an expense replaces the "no expenses for this trip" answer.
                abort_if($case->no_expenses_at !== null, 409, 'This trip was already recorded as having no expenses.');
                $userId = $request->user()->id;
                $stored = $files->store($proof, 'transaction-documents', $case->transaction_id)['path'];
                $documentId = (string) Str::uuid();
                DB::table('transaction_documents')->insert([
                    'id' => $documentId, 'transaction_id' => $case->transaction_id, 'document_kind' => 'expense_proof', 'storage_path' => $stored,
                    'uploader_id' => $userId, 'verification_state' => 'pending', 'upload_date' => now(),
                ]);
                DB::table('field_case_expenses')->insert([
                    'id' => (string) Str::uuid(), 'field_case_id' => $case->id, 'amount' => $data['amount'], 'description' => $description,
                    'proof_document_id' => $documentId, 'submitted_by' => $userId, 'submitted_at' => now(),
                ]);
                // SN-6: the case total shown in the list is always the sum of the filed rows.
                DB::table('field_cases')->where('id', $case->id)->update(['expenses_cents' => self::expensesCents($case->id), 'updated_at' => now()]);
            });
        } catch (\Throwable $e) {
            $files->delete('transaction-documents', $stored);
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /** recordFieldPrice (T03 CI1–CI3): Negotiated keeps the price; Displayed Price sets a new agreed price. */
    public function recordFieldPrice(Request $request): JsonResponse
    {
        Trading::run(function () use ($request) {
            $case = $this->assignedCase($request, $request->input('field_case_id'));
            abort_if($this->role($request) !== 'confidential_informant', 403, 'The Confidential Informant records the price status.');
            abort_if($case->case_kind !== 'acquisition' || ! $case->transaction_id, 422, 'Only seller meet-up cases have a price status.');
            $status = $request->input('status');
            abort_unless(in_array($status, ['negotiated', 'displayed_price'], true), 422, 'Invalid price status.');
            $confirmed = DB::table('sell_details')->where('transaction_id', $case->transaction_id)->lockForUpdate()->value('agreed_price');
            abort_if($confirmed === null, 422, 'There is no confirmed price yet.');
            $confirmed = (float) $confirmed;
            if ($status === 'negotiated') {
                abort_if($case->price_status === 'displayed_price', 409, 'The price was already changed at inspection.');
                DB::table('field_cases')->where('id', $case->id)->update(['price_status' => 'negotiated', 'updated_price' => null, 'discount_amount' => null, 'updated_at' => now()]);

                return;
            }
            $price = $request->input('updatedPrice');
            $discount = $request->input('discountAmount');
            abort_unless(is_numeric($price) && (float) $price > 0, 422, 'Enter an updated price above zero.');
            abort_unless(is_numeric($discount) && (float) $discount >= 0, 422, 'The discount cannot be negative.');
            abort_if((float) $price === $confirmed, 422, 'That is the confirmed price. Choose Negotiated instead.');
            DB::table('field_cases')->where('id', $case->id)->update(['price_status' => 'displayed_price', 'updated_price' => (float) $price, 'discount_amount' => (float) $discount, 'updated_at' => now()]);
            DB::table('sell_details')->where('transaction_id', $case->transaction_id)->update(['agreed_price' => (float) $price, 'updated_at' => now()]);
            $money = fn (float $v) => '₱'.number_format($v, 2);
            foreach (['marketing_specialist', 'sales_manager', 'ceo'] as $role) {
                Trading::notify(['role' => $role], 'field_price_changed', 'Price changed at inspection',
                    "The Confidential Informant changed the agreed price from {$money($confirmed)} to {$money((float) $price)} (discount {$money((float) $discount)}).", $case->transaction_id);
            }
        });

        return response()->json(['success' => true]);
    }
}
