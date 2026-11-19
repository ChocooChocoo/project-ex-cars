<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Leave, overtime, schedule-change and other requests (was src/app/(staff)/employee-requests/page.tsx and
 * actions.ts over the employee_requests RLS of 00015 + t06). Employees file and cancel their own; CEO/AM decide.
 * Proof files go up with the form (max 3, 2 MB each) into the private request-attachments bucket.
 */
class EmployeeRequestController extends Controller
{
    private const REVIEWERS = ['ceo', 'account_manager'];

    private const LEAVE_REASONS = ['sick', 'vacation', 'emergency', 'bereavement', 'maternity_paternity', 'others'];

    private const MAX_PROOFS = 3;

    public function index(Request $request, FileService $files): JsonResponse
    {
        $user = $request->user();
        $canReview = $user->hasRole(...self::REVIEWERS);
        $rows = DB::table('employee_requests as r')->leftJoin('profiles as p', 'p.id', '=', 'r.employee_id')
            ->when(! $canReview, fn ($q) => $q->where('r.employee_id', $user->id))
            ->orderByDesc('r.created_at')->get(['r.*', 'p.full_name']);
        $attachments = DB::table('employee_request_attachments')->whereIn('request_id', $rows->pluck('id'))->orderBy('created_at')->get()->groupBy('request_id');

        return response()->json([
            'canReview' => $canReview,
            'requests' => $rows->map(fn ($r) => [
                'id' => $r->id, 'employee_id' => $r->employee_id, 'employee_name' => $r->full_name, 'request_kind' => $r->request_kind,
                'status' => $r->status, 'start_date' => $r->start_date, 'end_date' => $r->end_date,
                'overtime_hours' => $r->overtime_hours === null ? null : (float) $r->overtime_hours, 'leave_reason' => $r->leave_reason,
                'reason' => $r->reason, 'review_notes' => $r->review_notes, 'reviewed_at' => ApiRow::iso($r->reviewed_at),
                'employee_request_attachments' => ($attachments[$r->id] ?? collect())->map(fn ($a) => [
                    'id' => $a->id, 'request_id' => $a->request_id, 'original_name' => $a->original_name, 'file_kind' => $a->file_kind,
                    'file_size' => $a->file_size === null ? null : (int) $a->file_size, 'signed_url' => $files->signedUrl('request-attachments', $a->storage_path),
                ])->values(),
            ]),
        ]);
    }

    public function submit(Request $request, FileService $files): JsonResponse
    {
        $user = $request->user();
        $kind = (string) $request->input('request_kind');
        abort_unless(in_array($kind, ['leave', 'overtime', 'schedule_change', 'other'], true), 422, 'Invalid request.');
        $data = $request->validate([
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'overtime_hours' => ['nullable', 'numeric'],
            'leave_reason' => ['nullable', 'string'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'proofs' => ['nullable', 'array', 'max:'.self::MAX_PROOFS],
            'proofs.*' => ['file'],
        ], ['start_date.*' => 'Date is required.', 'end_date.after_or_equal' => 'End date cannot be before the start date.', 'proofs.max' => 'Attach at most '.self::MAX_PROOFS.' files.']);
        $reason = trim((string) ($data['reason'] ?? ''));
        $row = ['request_kind' => $kind, 'start_date' => $data['start_date'], 'end_date' => null, 'overtime_hours' => null, 'leave_reason' => null, 'reason' => null];
        if ($kind === 'overtime') {
            $hours = $data['overtime_hours'] ?? null;
            abort_unless(is_numeric($hours), 422, 'Enter the overtime hours.');
            abort_if((float) $hours < 0.5, 422, 'Enter at least 0.5 hours.');
            abort_if((float) $hours > 12, 422, 'Enter at most 12 hours.');
            $row['overtime_hours'] = round((float) $hours, 2);
        } else {
            $row['end_date'] = $data['end_date'] ?? null;
            if ($kind === 'leave') {
                abort_unless(in_array($data['leave_reason'] ?? null, self::LEAVE_REASONS, true), 422, 'Choose a leave reason.');
                abort_if($data['leave_reason'] === 'others' && $reason === '', 422, 'Describe the reason for the leave.');
                $row['leave_reason'] = $data['leave_reason'];
                $row['reason'] = $reason === '' ? null : $reason;
            } else {
                abort_if($reason === '', 422, 'Reason is required.');
                $row['reason'] = $reason;
            }
        }

        /** @var list<UploadedFile> $proofs */
        $proofs = array_values(array_filter((array) $request->file('proofs', [])));
        $stored = [];
        try {
            foreach ($proofs as $index => $proof) {
                $stored[] = [...$files->store($proof, 'request-attachments', $user->id, "proofs.{$index}"), 'name' => mb_substr($proof->getClientOriginalName(), 0, 200)];
            }
            $id = (string) Str::uuid();
            Trading::run(function () use ($id, $row, $user, $stored) {
                DB::table('employee_requests')->insert($row + ['id' => $id, 'employee_id' => $user->id, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
                foreach ($stored as $file) {
                    DB::table('employee_request_attachments')->insert([
                        'id' => (string) Str::uuid(), 'request_id' => $id, 'storage_path' => $file['path'], 'original_name' => $file['name'],
                        'file_kind' => str_starts_with($file['mime'], 'image/') ? 'image' : 'file', 'file_size' => $file['size'], 'uploader_id' => $user->id, 'created_at' => now(),
                    ]);
                }
            });
        } catch (\Throwable $e) {
            foreach ($stored as $file) {
                $files->delete('request-attachments', $file['path']);
            }
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /** Own pending request only (RLS: own row while pending, new status pending/cancelled). */
    public function cancel(Request $request): JsonResponse
    {
        $id = $request->validate(['request_id' => ['required', 'uuid']])['request_id'];
        DB::table('employee_requests')->where('id', $id)->where('employee_id', $request->user()->id)->where('status', 'pending')
            ->update(['status' => 'cancelled', 'updated_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function review(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->hasRole(...self::REVIEWERS), 403, 'Not authorized to review requests');
        $data = $request->validate([
            'request_id' => ['required', 'uuid'],
            'decision' => ['required', 'in:approved,rejected'],
            'review_notes' => ['nullable', 'string', 'max:1000'],
        ]);
        DB::table('employee_requests')->where('id', $data['request_id'])->where('status', 'pending')->update([
            'status' => $data['decision'], 'reviewed_by' => $actor->id, 'review_notes' => ($data['review_notes'] ?? '') === '' ? null : $data['review_notes'],
            'reviewed_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }
}
