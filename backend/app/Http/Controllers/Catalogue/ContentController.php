<?php

namespace App\Http\Controllers\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\ContentItem;
use App\Models\Vehicle;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Showroom content items. Reads: CEO + Marketing Specialist; writes: Marketing Specialist (route middleware). */
class ContentController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'items' => ApiRow::list(ContentItem::query()->orderByDesc('created_at')->get()),
            'vehicles' => ApiRow::list(Vehicle::query()->orderByDesc('created_at')->get(['id', 'make', 'model', 'year'])),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $item = (new ContentItem)->forceFill($this->validated($request) + ['author_id' => $request->user()->id]);
        $item->save();

        return response()->json(ApiRow::of($item->fresh()), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $item = ContentItem::query()->findOrFail($id);
        $item->forceFill($this->validated($request))->save();

        return response()->json(ApiRow::of($item));
    }

    public function publish(string $id): JsonResponse
    {
        $item = ContentItem::query()->findOrFail($id);
        $item->forceFill(['publication_state' => 'published', 'published_at' => now()])->save();

        return response()->json(ApiRow::of($item));
    }

    public function destroy(string $id): JsonResponse
    {
        ContentItem::query()->findOrFail($id)->delete();

        return response()->json(['success' => true]);
    }

    /** Mirrors contentItemSchema in src/lib/validation/vehicles.ts. */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'content_kind' => ['required', 'in:hero,promotion,featured_vehicle'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,id'],
            'title' => ['required', 'string', 'min:1', 'max:200'],
            'body' => ['nullable', 'string', 'max:5000'],
        ], ['title.required' => 'Title is required.']);

        return ['content_kind' => $data['content_kind'], 'vehicle_id' => ($data['vehicle_id'] ?? null) ?: null, 'title' => $data['title'], 'body' => ($data['body'] ?? '') ?: null];
    }
}
