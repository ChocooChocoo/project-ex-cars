<?php

namespace App\Http\Controllers\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\Favourite;
use App\Models\Inquiry;
use App\Models\RecommendationFeedback;
use App\Models\RecommendationResult;
use App\Models\RecommendationRun;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Services\RecommendationService;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Recommendation runs of the signed-in user (was src/app/(customer)/recommendations/actions.ts). */
class RecommendationController extends Controller
{
    private const CRITERIA_VERSION = '1.0';

    public function store(Request $request, RecommendationService $engine): JsonResponse
    {
        // Next.js validates the preference fields with the shared zod schema; Laravel bounds what it stores.
        $data = $request->validate([
            'budget' => ['required', 'numeric', 'min:1000', 'max:9999999999'],
            'preferences' => ['required', 'array', 'max:20'],
            'preferences.*' => ['nullable', 'string', 'max:300'],
        ]);

        $vehicles = Vehicle::query()->where('listing_state', 'available')
            ->get(['id', 'current_price', 'condition', 'mileage', 'fuel_type', 'make', 'model', 'body_type', 'year']);
        abort_if($vehicles->isEmpty(), 422, 'No available vehicles found.');
        $ids = $vehicles->pluck('id');
        $bestInspection = VehicleInspection::query()->whereIn('vehicle_id', $ids)->whereNotNull('condition_score')
            ->groupBy('vehicle_id')->selectRaw('vehicle_id, MAX(condition_score) AS score')->pluck('score', 'vehicle_id');
        $favourites = Favourite::query()->whereIn('vehicle_id', $ids)->groupBy('vehicle_id')->selectRaw('vehicle_id, COUNT(*) AS n')->pluck('n', 'vehicle_id');
        $inquiries = Inquiry::query()->whereIn('vehicle_id', $ids)->groupBy('vehicle_id')->selectRaw('vehicle_id, COUNT(*) AS n')->pluck('n', 'vehicle_id');

        $inputs = $vehicles->map(fn (Vehicle $v) => [
            'id' => $v->id,
            'current_price' => $v->current_price === null ? null : (float) $v->current_price,
            'condition' => $v->condition,
            'mileage' => $v->mileage === null ? null : (int) $v->mileage,
            'fuel_type' => $v->fuel_type,
            'inspection_score' => isset($bestInspection[$v->id]) ? (float) $bestInspection[$v->id] : null,
            'favourite_count' => (int) ($favourites[$v->id] ?? 0),
            'inquiry_count' => (int) ($inquiries[$v->id] ?? 0),
        ])->all();
        $scored = $engine->rank($inputs, (float) $data['budget']);

        $run = DB::transaction(function () use ($request, $data, $scored) {
            $run = (new RecommendationRun)->forceFill([
                'customer_id' => $request->user()->id,
                'budget' => $data['budget'],
                'stated_preferences' => json_encode($data['preferences']),
                'criteria_version' => self::CRITERIA_VERSION,
            ]);
            $run->save();
            foreach ($scored as $s) {
                (new RecommendationResult)->forceFill([
                    'run_id' => $run->id, 'vehicle_id' => $s['vehicleId'],
                    'budget_score' => $s['budgetScore'], 'condition_score' => $s['conditionScore'],
                    'fuel_score' => $s['fuelScore'], 'demand_score' => $s['demandScore'],
                    'mileage_score' => $s['mileageScore'], 'total_score' => $s['totalScore'], 'rank' => $s['rank'],
                ])->save();
            }

            return $run;
        });

        return response()->json(['runId' => $run->id, 'scored' => $scored], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $runs = RecommendationRun::query()->where('customer_id', $request->user()->id)->orderByDesc('run_date')->get();

        return response()->json(ApiRow::list($runs));
    }

    /** One own run with its ranked results and the display fields of each ranked car. */
    public function show(Request $request, string $runId): JsonResponse
    {
        $run = $this->ownRun($request, $runId);
        $results = RecommendationResult::query()->where('run_id', $runId)->orderBy('rank')->get();
        $vehicles = Vehicle::query()->whereIn('id', $results->pluck('vehicle_id'))
            ->whereIn('listing_state', ['available', 'reserved', 'sold'])
            ->get(['id', 'make', 'model', 'year', 'current_price', 'condition', 'mileage', 'fuel_type', 'body_type']);

        return response()->json(['run' => ApiRow::of($run), 'results' => ApiRow::list($results), 'vehicles' => ApiRow::list($vehicles)]);
    }

    public function feedback(Request $request, string $runId): JsonResponse
    {
        $this->ownRun($request, $runId);
        $data = $request->validate([
            'selected_vehicle_id' => ['required', 'uuid', 'exists:recommendation_results,vehicle_id,run_id,'.$runId],
            'helpful' => ['required', 'boolean'],
            'outcome' => ['nullable', 'string', 'max:500'],
        ]);
        (new RecommendationFeedback)->forceFill([
            'run_id' => $runId,
            'selected_vehicle_id' => $data['selected_vehicle_id'],
            'helpful_state' => $data['helpful'] ? 'helpful' : 'not_helpful',
            'outcome' => $data['outcome'] ?? null,
        ])->save();

        return response()->json(['success' => true], 201);
    }

    private function ownRun(Request $request, string $runId): RecommendationRun
    {
        $run = RecommendationRun::query()->findOrFail($runId);
        abort_unless($run->customer_id === $request->user()->id, 403, 'Access denied');

        return $run;
    }
}
