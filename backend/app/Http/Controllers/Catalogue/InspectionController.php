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
    /** Roles that read the /inspections page and its detail (routes/api.php; the page checks the same list). */
    public const VIEWER_ROLES = ['ceo', 'account_manager', 'confidential_informant', 'mechanic', 'sales_manager'];

    /**
     * SH-3: the roles that may read an inspection RESULT attached to a fund request they are reviewing. That is the
     * page's audience plus the Head Accountant, who decides whether to release the money for the car. It is a
     * separate list on purpose: the Head Accountant gains the result beside the fund, never the /inspections page.
     */
    public const FUND_RESULT_ROLES = [...self::VIEWER_ROLES, 'head_accountant'];

    public static function canReadFundResult(?object $user): bool
    {
        return (bool) $user?->hasRole(...self::FUND_RESULT_ROLES);
    }

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
