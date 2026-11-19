<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Support\ApiRow;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Announcements (was src/app/(staff)/announcements): the CEO writes; staff read published, unexpired ones. */
class AnnouncementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $isCeo = $request->user()->hasRole('ceo');
        $rows = DB::table('announcements')
            ->when(! $isCeo, fn ($q) => $q->where('status', 'published')->where(fn ($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>=', now())))
            ->orderByDesc('created_at')->get();

        return response()->json([
            'canManage' => $isCeo,
            'announcements' => $rows->map(fn ($a) => [
                'id' => $a->id, 'title' => $a->title, 'body' => $a->body, 'status' => $a->status, 'author_id' => $a->author_id,
                'published_at' => ApiRow::iso($a->published_at), 'expires_at' => ApiRow::iso($a->expires_at), 'created_at' => ApiRow::iso($a->created_at),
            ]),
        ]);
    }

    public function create(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
            'expires_at' => ['nullable', 'date'],
        ], ['title.required' => 'Title is required.', 'body.required' => 'Body is required.']);
        DB::table('announcements')->insert([
            'id' => (string) Str::uuid(), 'title' => $data['title'], 'body' => $data['body'], 'status' => 'draft', 'author_id' => $request->user()->id,
            'expires_at' => empty($data['expires_at']) ? null : CarbonImmutable::parse($data['expires_at'])->utc(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    /** publish / expire / archive. */
    public function setStatus(Request $request, string $status): JsonResponse
    {
        abort_unless(in_array($status, ['published', 'expired', 'archived'], true), 404);
        $id = $request->validate(['announcement_id' => ['required', 'uuid']])['announcement_id'];
        DB::table('announcements')->where('id', $id)->update(['status' => $status, 'updated_at' => now()]
            + ($status === 'published' ? ['published_at' => now()] : []));

        return response()->json(['success' => true]);
    }
}
