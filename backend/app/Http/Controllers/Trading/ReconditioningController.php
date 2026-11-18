<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Reconditioning workflow (was src/app/(staff)/vehicles/reconditioning-actions.ts). The report creates the
 * fund request (submitted); releasing it, shortfall requests and refund confirmation are Phase 6.
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

    /** submitReconditioningReport (§6 steps 27–30): status report, parts with photos, and the fund request. */
    public function submitReport(Request $request, FileService $files): JsonResponse
    {
        abort_unless($request->user()->hasRole('mechanic'), 403, 'Not authorized for this reconditioning step.');
        $parts = json_decode((string) $request->input('parts', '[]'), true);
        abort_unless(is_array($parts), 422, 'Add at least one valid part.');
        $statusReport = trim((string) $request->input('status_report'));
        abort_if($statusReport === '', 422, "Describe the car's overall condition.");
        abort_if(mb_strlen($statusReport) > 4000, 422, 'Invalid report.');
        abort_if(count($parts) === 0, 422, 'Add at least one part.');
        foreach ($parts as $part) {
            abort_if(trim((string) ($part['part_name'] ?? '')) === '', 422, 'Name every part.');
            abort_if(trim((string) ($part['replacement_brand'] ?? '')) === '', 422, 'Give the replacement brand.');
            abort_unless(is_numeric($part['estimated_cost'] ?? null) && (float) $part['estimated_cost'] >= 0, 422, 'An estimate cannot be negative.');
        }
        $photos = [];
        foreach (array_keys($parts) as $index) {
            $photo = $request->file("part_photo_{$index}");
            abort_if(! $photo || $photo->getSize() === 0, 422, 'Add a photo of every part.');
            abort_if($photo->getSize() > FileService::MAX_BYTES || ! in_array((new \finfo(FILEINFO_MIME_TYPE))->file($photo->getRealPath()), ['image/jpeg', 'image/png', 'image/webp'], true), 422,
                'Part photos must be JPEG, PNG or WebP images of 2 MB or less.');
            $photos[] = $photo;
        }
        $userId = $request->user()->id;
        $stored = [];
        try {
            Trading::run(function () use ($request, $files, $parts, $photos, $statusReport, $userId, &$stored) {
                $job = $this->lockJob($request->input('job_id'));
                abort_if($job->state !== 'awaiting_report', 409, 'This car is not waiting for a status report.');
                abort_if($job->mechanic_id && $job->mechanic_id !== $userId, 403, 'Only the assigned Mechanic can report on this car.');
                $total = (int) array_sum(array_map(fn ($p) => (int) round((float) $p['estimated_cost'] * 100), $parts));
                $summary = implode(', ', array_map(fn ($p) => trim($p['part_name']).' ('.trim($p['replacement_brand']).')', $parts));
                foreach ($photos as $photo) {
                    $stored[] = $files->store($photo, 'reconditioning-receipts', "parts/{$job->id}")['path'];
                }
                DB::table('reconditioning_parts')->where('job_id', $job->id)->delete();
                foreach (array_values($parts) as $i => $part) {
                    DB::table('reconditioning_parts')->insert([
                        'id' => (string) Str::uuid(), 'job_id' => $job->id, 'part_name' => trim($part['part_name']), 'replacement_brand' => trim($part['replacement_brand']),
                        'estimated_cost_cents' => (int) round((float) $part['estimated_cost'] * 100), 'photo_path' => $stored[$i], 'created_at' => now(), 'updated_at' => now(),
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

    /** completeReconditioning (§6 steps 34–36): the final report; leftover funds become a refund due. */
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
            if ($refund > 0) {
                self::notifyRole('head_accountant', 'Reconditioning refund due', 'Repairs cost '.self::peso($actual / 100).'. The Mechanic must return '.self::peso($refund / 100).' of the released funds.',
                    'transactions', $job->transaction_id);
            }
            self::notifyRole('marketing_specialist', 'Reconditioned car ready for repricing', 'Repairs cost '.self::peso($actual / 100).'. Review the reports and propose the revised price.', 'vehicles', $job->vehicle_id);
        });

        return response()->json(['success' => true]);
    }

    /** markPapersProcessed (§6 step 33). */
    public function markPapersProcessed(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('sales_manager'), 403, 'Not authorized for this reconditioning step.');
        $userId = $request->user()->id;
        Trading::run(function () use ($request, $userId) {
            $job = $this->lockJob($request->input('job_id'));
            abort_if((bool) $job->papers_processed_at, 409, 'The papers are already re-processed.');
            DB::table('reconditioning_jobs')->where('id', $job->id)->update(['papers_processed_at' => now(), 'papers_processed_by' => $userId]);
        });

        return response()->json(['success' => true]);
    }
}
