<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Business roadmap (was src/app/(staff)/roadmap). Policy gap 3 closed: the old RLS let any active role, customers
 * included, read roadmap_items; now only the page's readers (CEO, Account Manager, Sales Manager) read it and only
 * the CEO writes (route middleware).
 */
class RoadmapController extends Controller
{
    private static function row(object $r): array
    {
        return ['id' => $r->id, 'parent_id' => $r->parent_id, 'kind' => $r->kind, 'title' => $r->title, 'description' => $r->description,
            'status' => $r->status, 'priority' => $r->priority, 'quarter' => $r->quarter, 'year' => $r->year === null ? null : (int) $r->year,
            'team' => $r->team, 'start_date' => $r->start_date, 'end_date' => $r->end_date, 'created_by' => $r->created_by,
            'created_at' => ApiRow::iso($r->created_at), 'updated_at' => ApiRow::iso($r->updated_at)];
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'canWrite' => $request->user()->hasRole('ceo'),
            'items' => DB::table('roadmap_items')->orderBy('created_at')->get()->map(fn ($r) => self::row($r)),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $item = Str::isUuid($id) ? DB::table('roadmap_items')->where('id', $id)->first() : null;
        abort_unless($item, 404, 'Roadmap item not found.');

        return response()->json([
            'item' => self::row($item),
            'children' => DB::table('roadmap_items')->where('parent_id', $id)->orderBy('created_at')->get()->map(fn ($r) => self::row($r)),
        ]);
    }

    private static function fields(Request $request): array
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'uuid', 'exists:roadmap_items,id'],
            'kind' => ['required', 'in:initiative,epic,feature'],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', 'in:planned,in_progress,completed,on_hold'],
            'priority' => ['required', 'in:high,medium,low'],
            'quarter' => ['nullable', 'in:Q1,Q2,Q3,Q4'],
            'year' => ['nullable', 'integer', 'between:2000,2100'],
            'team' => ['nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ], ['title.required' => 'Title is required.', 'year.between' => 'Year must be 2000 or later.', 'end_date.after_or_equal' => 'End date must be on or after the start date.']);
        $hasParent = ! empty($data['parent_id']);
        abort_if(($data['kind'] === 'initiative') === $hasParent, 422, 'Initiatives cannot have a parent; epics and features require one.');
        foreach (['parent_id', 'description', 'quarter', 'year', 'team', 'start_date', 'end_date'] as $key) {
            $data[$key] = ($data[$key] ?? '') === '' ? null : $data[$key];
        }

        return $data;
    }

    public function create(Request $request): JsonResponse
    {
        $id = (string) Str::uuid();
        DB::table('roadmap_items')->insert(self::fields($request) + ['id' => $id, 'created_by' => $request->user()->id, 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['success' => true, 'id' => $id]);
    }

    public function update(Request $request): JsonResponse
    {
        $id = $request->validate(['id' => ['required', 'uuid', 'exists:roadmap_items,id']])['id'];
        $fields = self::fields($request);
        abort_if($fields['parent_id'] === $id, 422, 'An item cannot be its own parent.');
        DB::table('roadmap_items')->where('id', $id)->update($fields + ['updated_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function destroy(string $id): JsonResponse
    {
        abort_unless(Str::isUuid($id), 404);
        DB::table('roadmap_items')->where('id', $id)->delete();

        return response()->json(['success' => true]);
    }
}
