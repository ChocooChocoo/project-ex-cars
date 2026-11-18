<?php

namespace App\Http\Controllers\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\Favourite;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A signed-in user's own favourites. The owner is always the session user. */
class FavouriteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $vehicles = Vehicle::query()
            ->whereIn('id', Favourite::query()->where('customer_id', $request->user()->id)->select('vehicle_id'))
            ->get();

        return response()->json($vehicles->map(fn (Vehicle $v) => ShowroomController::publicVehicle($v))->values());
    }

    public function toggle(Request $request, string $vehicleId): JsonResponse
    {
        Vehicle::query()->findOrFail($vehicleId);
        $userId = $request->user()->id;
        $existing = Favourite::query()->where('customer_id', $userId)->where('vehicle_id', $vehicleId)->first();
        if ($existing) {
            $existing->delete();

            return response()->json(['favourited' => false]);
        }
        (new Favourite)->forceFill(['customer_id' => $userId, 'vehicle_id' => $vehicleId])->save();

        return response()->json(['favourited' => true]);
    }
}
