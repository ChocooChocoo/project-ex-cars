<?php

namespace App\Http\Controllers\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\InspectionChecklistNode;
use App\Models\InspectionChecklistResult;
use App\Models\PartReplacement;
use App\Models\VehicleInspection;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;

/** Inspection read models for (staff)/inspections. Route group limits roles to INSPECTION_VIEWER_ROLES. */
class InspectionController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = VehicleInspection::query()->with('vehicle:id,make,model,year,stock_code')->orderByDesc('inspection_date')->get();

        return response()->json($rows->map(fn ($i) => $this->row($i))->values());
    }

    public function show(string $id): JsonResponse
    {
        $inspection = VehicleInspection::query()->with('vehicle:id,make,model,year,stock_code')->findOrFail($id);
        $checklist = InspectionChecklistNode::query()->where('active', true)->orderBy('display_order')->get();
        $results = InspectionChecklistResult::query()->where('inspection_id', $id)->get();
        $parts = PartReplacement::query()->whereIn('checklist_answer_id', $results->pluck('id'))->get()->groupBy('checklist_answer_id');

        return response()->json([
            'inspection' => $this->row($inspection),
            'checklist' => ApiRow::list($checklist),
            'results' => $results->map(fn ($r) => ApiRow::of($r) + ['part_replacements' => ApiRow::list($parts[$r->id] ?? [])])->values(),
        ]);
    }

    private function row(VehicleInspection $inspection): array
    {
        return ApiRow::of($inspection) + ['vehicles' => ApiRow::of($inspection->vehicle, ['make', 'model', 'year', 'stock_code'])];
    }
}
