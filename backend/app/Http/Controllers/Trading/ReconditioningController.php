<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\Finance\Money;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Reconditioning workflow (was src/app/(staff)/vehicles/reconditioning-actions.ts and, from Phase 6,
 * reconditioning-fund-actions.ts). The report creates the fund request; the Head Accountant releases it from
 * Finance (FinanceController::advance); a shortfall needs another itemised request with receipts.
 */
class ReconditioningController extends Controller
{
    private const FUNDED = ['released', 'received', 'paid'];

    private function lockJob(mixed $id): object
    {
        abort_unless(is_string($id) && Str::isUuid($id), 404, 'Reconditioning job not found.');
        $job = DB::table('reconditioning_jobs')->where('id', $id)->lockForUpdate()->first();
        abort_unless($job, 404, 'Reconditioning job not found.');

        return $job;
    }

    /** reconditioning-funds.ts releasedFundsCents. */
    private static function releasedCents(object $job): int
    {
        $requests = DB::table('reconditioning_fund_requests as f')->leftJoin('disbursement_requests as d', 'd.id', '=', 'f.disbursement_id')
            ->where('f.job_id', $job->id)->get(['f.amount_cents', 'f.state', 'd.status']);
        if ($requests->isEmpty()) {
            $fallback = $job->disbursement_id ? DB::table('disbursement_requests')->where('id', $job->disbursement_id)->first(['status', 'amount_cents']) : null;

            return in_array($fallback?->status, self::FUNDED, true) ? max(0, (int) round((float) $fallback->amount_cents)) : 0;
        }

        return (int) $requests->sum(fn ($r) => in_array($r->status ?? $r->state, self::FUNDED, true) ? max(0, (int) round((float) $r->amount_cents)) : 0);
    }

    /** True when the report was sent, a fund request exists, and the Head Accountant rejected every one of them. */
    private static function allFundRequestsRejected(object $job): bool
    {
        $statuses = DB::table('reconditioning_fund_requests as f')->leftJoin('disbursement_requests as d', 'd.id', '=', 'f.disbursement_id')
            ->where('f.job_id', $job->id)->get(['f.state', 'd.status'])->map(fn ($r) => $r->status ?? $r->state);

        return $statuses->isNotEmpty() && $statuses->every(fn ($s) => $s === 'rejected');
    }

    private static function notifyRole(string $role, string $title, string $body, ?string $table, ?string $id): void
    {
        if ($id) {
            Trading::notify(['role' => $role], 'reconditioning', $title, $body, $id, (string) $table);

            return;
        }
        // No reference: written directly (Trading::notify always carries one).
        DB::afterCommit(fn () => DB::table('notifications')->insert([
            'id' => (string) Str::uuid(), 'recipient_role' => $role, 'kind' => 'reconditioning', 'title' => $title, 'body' => $body, 'created_at' => now(),
        ]));
    }

    private static function peso(float $amount): string
    {
        return '₱'.Trading::peso($amount);
    }

    /** SH-4: the first inspection photo stored for this checklist answer, if any. */
    private function inspectionPhoto(string $resultId): ?string
    {
        $answer = DB::table('inspection_checklist_results')->where('id', $resultId)->first(['inspection_id', 'checklist_entry_id']);
        if (! $answer) {
            return null;
        }
        $fieldCaseId = DB::table('vehicle_inspections')->where('id', $answer->inspection_id)->value('field_case_id');
        $transactionId = $fieldCaseId ? DB::table('field_cases')->where('id', $fieldCaseId)->value('transaction_id') : null;
        if (! $transactionId) {
            return null;
        }

        return DB::table('transaction_documents')->where('transaction_id', $transactionId)->where('document_kind', 'inspection_photo')
            ->where('note', $answer->checklist_entry_id)->orderBy('upload_date')->value('storage_path');
    }

    /**
     * submitReconditioningReport (§6 steps 27–30, SH-4): status report, parts with photos, and the fund request.
     *
     * A row may carry the `result_id` of a `for_repair` answer of the car's acquisition inspection: the part is
     * then already known by name, and the inspection photo is reused when the Mechanic attaches no new one.
     */
    public function submitReport(Request $request, FileService $files): JsonResponse
    {
        abort_unless($request->user()->hasRole('mechanic'), 403, 'Not authorized for this reconditioning step.');
        $parts = json_decode((string) $request->input('parts', '[]'), true);
        abort_unless(is_array($parts), 422, 'Add at least one valid part.');
        $statusReport = trim((string) $request->input('status_report'));
        abort_if($statusReport === '', 422, "Describe the car's overall condition.");
        abort_if(mb_strlen($statusReport) > 4000, 422, 'Invalid report.');
        abort_if(count($parts) === 0, 422, 'Add at least one part.');
        $resultIds = [];
        foreach ($parts as $part) {
            abort_if(trim((string) ($part['part_name'] ?? '')) === '', 422, 'Name every part.');
            abort_if(trim((string) ($part['replacement_brand'] ?? '')) === '', 422, 'Give the replacement brand.');
            abort_unless(is_numeric($part['estimated_cost'] ?? null) && (float) $part['estimated_cost'] >= 0, 422, 'An estimate cannot be negative.');
            $resultId = $part['result_id'] ?? null;
            if ($resultId !== null && $resultId !== '') {
                abort_unless(is_string($resultId) && Str::isUuid($resultId), 422, 'Add a valid part.');
                $resultIds[] = $resultId;
            }
        }
        $photos = [];
        foreach (array_keys($parts) as $index) {
            $photo = $request->file("part_photo_{$index}");
            if (! $photo || $photo->getSize() === 0) {
                // SH-4: no new photo is fine when the row comes from the inspection and has one to reuse.
                abort_if(! ($parts[$index]['result_id'] ?? null) || ! $this->inspectionPhoto((string) $parts[$index]['result_id']), 422, 'Add a photo of every part.');
                $photos[$index] = null;
                continue;
            }
            abort_if($photo->getSize() > FileService::MAX_BYTES || ! in_array((new \finfo(FILEINFO_MIME_TYPE))->file($photo->getRealPath()), ['image/jpeg', 'image/png', 'image/webp'], true), 422,
                'Part photos must be JPEG, PNG or WebP images of 2 MB or less.');
            $photos[$index] = $photo;
        }
        $userId = $request->user()->id;
        $stored = [];
        try {
            Trading::run(function () use ($request, $files, $parts, $photos, $statusReport, $userId, $resultIds, &$stored) {
                $job = $this->lockJob($request->input('job_id'));
                // A rejected fund request is a dead end otherwise: the Mechanic sends a new report and a new request.
                abort_unless($job->state === 'awaiting_report' || ($job->state === 'awaiting_funds' && self::allFundRequestsRejected($job)), 409,
                    'This car is not waiting for a status report.');
                abort_if($job->mechanic_id && $job->mechanic_id !== $userId, 403, 'Only the assigned Mechanic can report on this car.');
                foreach ($resultIds as $resultId) {
                    abort_unless(DB::table('inspection_checklist_results')->where('id', $resultId)->exists(), 422, 'Add a valid part.');
                }
                $total = (int) array_sum(array_map(fn ($p) => Money::cents($p['estimated_cost']), $parts));
                $summary = implode(', ', array_map(fn ($p) => trim($p['part_name']).' ('.trim($p['replacement_brand']).')', $parts));
                // One photo per part row; a reused inspection photo is copied into the reconditioning bucket.
                $paths = [];
                foreach (array_values($parts) as $i => $part) {
                    if ($photos[$i] instanceof \Illuminate\Http\UploadedFile) {
                        $paths[$i] = $stored[] = $files->store($photos[$i], 'reconditioning-receipts', "parts/{$job->id}")['path'];
                        continue;
                    }
                    $source = $this->inspectionPhoto((string) $part['result_id']);
                    abort_unless($source, 422, 'Add a photo of every part.');
                    $paths[$i] = "parts/{$job->id}/".Str::uuid().'.'.strtolower(pathinfo($source, PATHINFO_EXTENSION));
                    $files->disk('reconditioning-receipts')->copy('transaction-documents/'.$source, 'reconditioning-receipts/'.$paths[$i]);
                    $stored[] = $paths[$i];
                }
                DB::table('reconditioning_parts')->where('job_id', $job->id)->delete();
                foreach (array_values($parts) as $i => $part) {
                    DB::table('reconditioning_parts')->insert([
                        'id' => (string) Str::uuid(), 'job_id' => $job->id, 'part_name' => trim($part['part_name']), 'replacement_brand' => trim($part['replacement_brand']),
                        'estimated_cost_cents' => Money::cents($part['estimated_cost']), 'photo_path' => $paths[$i], 'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
                $requestId = (string) Str::uuid();
                DB::table('disbursement_requests')->insert([
                    'id' => $requestId, 'title' => 'Reconditioning fund', 'amount_cents' => $total, 'purpose' => 'Repair and reconditioning: '.mb_substr($summary, 0, 200),
                    'status' => 'submitted', 'requested_by' => $userId, 'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('reconditioning_fund_requests')->insert([
                    'id' => (string) Str::uuid(), 'job_id' => $job->id, 'disbursement_id' => $requestId, 'amount_cents' => $total,
                    'reason' => 'Initial parts and labor estimate', 'state' => 'submitted', 'created_by' => $userId, 'created_at' => now(),
                ]);
                DB::table('reconditioning_jobs')->where('id', $job->id)->update([
                    'state' => 'awaiting_funds', 'status_report' => $statusReport, 'required_parts' => $summary, 'estimated_cost' => $total / 100,
                    'disbursement_id' => $requestId, 'mechanic_id' => $userId,
                ]);
                self::notifyRole('head_accountant', 'Reconditioning fund request',
                    'The Mechanic estimates '.self::peso($total / 100).' to recondition a car. Review the parts table and release it from Finance.',
                    'transactions', $job->transaction_id);
            });
        } catch (\Throwable $e) {
            foreach ($stored as $path) {
                $files->delete('reconditioning-receipts', $path);
            }
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /** startReconditioning (§6 step 31): once the Head Accountant has released the funds. */
    public function start(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('mechanic'), 403, 'Not authorized for this reconditioning step.');
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $userId) {
            $job = $this->lockJob($request->input('job_id'));
            abort_if($job->state !== 'awaiting_funds', 409, 'This job is not waiting for funds.');
            abort_if($job->mechanic_id && $job->mechanic_id !== $userId, 403, 'Only the assigned Mechanic can start this job.');
            abort_if(self::releasedCents($job) <= 0, 422, 'Start once the Head Accountant releases the funds.');
            DB::table('reconditioning_jobs')->where('id', $job->id)->update(['state' => 'in_progress']);
        });

        return response()->json(['success' => true]);
    }

    /** completeReconditioning (§6 steps 34–36, SH-1): the final report; leftover funds become a refund due. */
    public function complete(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('mechanic'), 403, 'Not authorized for this reconditioning step.');
        $report = trim((string) $request->input('final_report'));
        abort_if($report === '', 422, "Describe the repairs done and the car's condition.");
        abort_if(mb_strlen($report) > 4000, 422, 'Invalid report.');
        $cost = $request->input('actual_cost');
        abort_unless(is_numeric($cost) && (float) $cost >= 0, 422, 'Enter the actual cost.');
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $report, $cost, $userId) {
            $job = $this->lockJob($request->input('job_id'));
            abort_if($job->state !== 'in_progress', 409, 'This job is not in progress.');
            abort_if($job->mechanic_id && $job->mechanic_id !== $userId, 403, 'Only the assigned Mechanic can complete this job.');
            $released = self::releasedCents($job);
            $actual = (int) round((float) $cost * 100);
            abort_if($actual > $released, 422, 'The actual cost is '.self::peso(($actual - $released) / 100).' over the released funds. Request the shortfall first.');
            $refund = max(0, $released - $actual);
            DB::table('reconditioning_jobs')->where('id', $job->id)->update([
                'state' => 'completed', 'final_report' => $report, 'actual_cost' => $actual / 100, 'completed_at' => now(), 'refund_due_cents' => $refund,
            ]);
            // SH-1: the car leaves "Repairing" for every role. It is ready to be repriced, exactly as the no-issue
            // path leaves a bought car; nothing (no Sales Manager papers step) sits between the two states any more.
            DB::table('vehicles')->where('id', $job->vehicle_id)->where('listing_state', 'repairing')
                ->update(['listing_state' => 'awaiting_price_approval', 'updated_at' => now()]);
            if ($refund > 0) {
                self::notifyRole('head_accountant', 'Reconditioning refund due', 'Repairs cost '.self::peso($actual / 100).'. The Mechanic must return '.self::peso($refund / 100).' of the released funds.',
                    'transactions', $job->transaction_id);
            }
            self::notifyRole('marketing_specialist', 'Reconditioned car ready for repricing', 'Repairs cost '.self::peso($actual / 100).'. Review the reports and propose the revised price.', 'vehicles', $job->vehicle_id);
        });

        return response()->json(['success' => true]);
    }

    /** §6 step 32: a shortfall during the work needs another itemised request with receipt photos. */
    public function requestFunds(Request $request, FileService $files): JsonResponse
    {
        abort_unless($request->user()->hasRole('mechanic'), 403, 'Not authorized for this reconditioning step.');
        abort_unless(is_numeric($request->input('amount')) && (float) $request->input('amount') > 0, 422, 'Enter the extra amount needed.');
        $reason = trim((string) $request->input('shortfall_reason'));
        abort_if(mb_strlen($reason) < 10, 422, 'Explain why the funds ran short.');
        abort_if(mb_strlen($reason) > 2000, 422, 'Invalid request.');
        // One photo arrives as `receipts`, several as `receipts[]` (laravelForm).
        $sent = $request->file('receipts');
        $receipts = array_values(array_filter(is_array($sent) ? $sent : ($sent ? [$sent] : []), fn ($f) => $f && $f->getSize() > 0));
        abort_if($receipts === [], 422, 'Attach at least one receipt photo.');
        foreach ($receipts as $file) {
            abort_unless(in_array((new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath()), ['image/jpeg', 'image/png', 'image/webp'], true), 422, 'Receipts must be JPEG, PNG or WebP photos.');
            abort_if($file->getSize() > FileService::MAX_BYTES, 422, 'Each receipt must be 2 MB or smaller.');
        }
        $cents = Money::cents($request->input('amount'));
        $userId = $request->user()->id;
        $stored = [];
        try {
            Trading::run(function () use ($request, $files, $receipts, $reason, $cents, $userId, &$stored) {
                $job = $this->lockJob($request->input('job_id'));
                abort_if($job->state !== 'in_progress', 409, 'Request extra funds only while repairs are in progress.');
                abort_if($job->mechanic_id && $job->mechanic_id !== $userId, 403, 'Only the assigned Mechanic can request funds.');
                foreach ($receipts as $file) {
                    $stored[] = $files->store($file, 'reconditioning-receipts', $job->id, 'receipts')['path'];
                }
                $requestId = (string) Str::uuid();
                DB::table('disbursement_requests')->insert(['id' => $requestId, 'title' => 'Reconditioning shortfall', 'amount_cents' => $cents,
                    'purpose' => mb_substr($reason, 0, 200), 'status' => 'submitted', 'requested_by' => $userId, 'created_at' => now(), 'updated_at' => now()]);
                $fundId = (string) Str::uuid();
                DB::table('reconditioning_fund_requests')->insert(['id' => $fundId, 'job_id' => $job->id, 'disbursement_id' => $requestId, 'amount_cents' => $cents,
                    'reason' => 'Reconditioning shortfall', 'shortfall_reason' => $reason, 'state' => 'submitted', 'created_by' => $userId, 'created_at' => now()]);
                foreach ($stored as $path) {
                    DB::table('reconditioning_fund_receipts')->insert(['id' => (string) Str::uuid(), 'fund_request_id' => $fundId, 'storage_path' => $path, 'uploaded_by' => $userId, 'created_at' => now()]);
                }
                self::notifyRole('head_accountant', 'Reconditioning shortfall', 'The Mechanic needs ₱'.Money::peso($cents)." more. {$reason}", 'transactions', $job->transaction_id);
            });
        } catch (\Throwable $e) {
            foreach ($stored as $path) {
                $files->delete('reconditioning-receipts', $path);
            }
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /** The Mechanic (or the Head Accountant) records the leftover of a completed job returned to GCE. */
    public function markRefundReturned(Request $request): JsonResponse
    {
        $role = (string) $request->user()->role()?->value;
        abort_unless(in_array($role, ['mechanic', 'head_accountant'], true), 403, 'Not authorized for this reconditioning step.');
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $role, $userId) {
            $job = $this->lockJob($request->input('job_id'));
            abort_if($job->state !== 'completed', 409, 'This job is not completed.');
            abort_if($role === 'mechanic' && $job->mechanic_id && $job->mechanic_id !== $userId, 403, 'Only the assigned Mechanic can return the leftover funds.');
            abort_if((int) $job->refund_due_cents <= 0, 422, 'There is no leftover to return.');
            abort_if($job->refunded_at, 409, 'The leftover is already marked returned.');
            DB::table('reconditioning_jobs')->where('id', $job->id)->whereNull('refunded_at')->update(['refunded_at' => now()]);
            self::notifyRole('head_accountant', 'Reconditioning refund returned',
                ($role === 'head_accountant' ? 'The Head Accountant' : 'The Mechanic').' recorded ₱'.Money::peso((int) $job->refund_due_cents).' returned to GCE.', 'transactions', $job->transaction_id);
        });

        return response()->json(['success' => true]);
    }
}
