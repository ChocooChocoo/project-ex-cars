<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Finance and management reports (was src/app/(staff)/reports). CEO/HA/AM submit (the submitter is the session
 * user, which the old RLS insert rule did not check); CEO/HA read and review all; AM reads their own.
 */
class ReportController extends Controller
{
    private const REVIEWERS = ['ceo', 'head_accountant'];

    private const KINDS = ['attendance', 'payroll', 'disbursement', 'expense', 'revenue', 'inventory', 'sales', 'management', 'other'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = DB::table('reports')->when(! $user->hasRole(...self::REVIEWERS), fn ($q) => $q->where('submitted_by', $user->id))
            ->orderByDesc('created_at')->get();

        return response()->json([
            'role' => $user->role()->value,
            'reports' => $rows->map(fn ($r) => [
                'id' => $r->id, 'report_kind' => $r->report_kind, 'title' => $r->title, 'description' => $r->description, 'submitted_by' => $r->submitted_by,
                'evidence_storage_path' => $r->evidence_storage_path, 'status' => $r->status, 'period_start' => $r->period_start, 'period_end' => $r->period_end,
                'created_at' => ApiRow::iso($r->created_at), 'updated_at' => ApiRow::iso($r->updated_at),
            ]),
        ]);
    }

    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'report_kind' => ['required', 'in:'.implode(',', self::KINDS)],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'period_start' => ['nullable', 'date_format:Y-m-d'],
            'period_end' => ['nullable', 'date_format:Y-m-d'],
        ], ['title.required' => 'Title is required.']);
        DB::table('reports')->insert([
            'id' => (string) Str::uuid(), 'report_kind' => $data['report_kind'], 'title' => $data['title'],
            'description' => ($data['description'] ?? '') === '' ? null : $data['description'], 'submitted_by' => $request->user()->id,
            'status' => 'submitted', 'period_start' => $data['period_start'] ?? null, 'period_end' => $data['period_end'] ?? null,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    public function review(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole(...self::REVIEWERS), 403, 'Not authorized to review reports');
        $id = $request->validate(['report_id' => ['required', 'uuid']], ['report_id.*' => 'Report not found or not authorized to review it.'])['report_id'];
        abort_unless(DB::table('reports')->where('id', $id)->exists(), 404, 'Report not found or not authorized to review it.');
        DB::table('reports')->where('id', $id)->update(['status' => 'reviewed', 'updated_at' => now()]);

        return response()->json(['success' => true]);
    }
}
