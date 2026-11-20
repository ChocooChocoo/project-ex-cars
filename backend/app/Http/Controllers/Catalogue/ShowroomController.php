<?php

namespace App\Http\Controllers\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\ContentItem;
use App\Models\CustomerReview;
use App\Models\Favourite;
use App\Models\Profile;
use App\Models\Vehicle;
use App\Models\VehicleMedia;
use App\Services\FileService;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Public and customer showroom reads (was the anon/admin Supabase reads in the customer and landing pages). */
class ShowroomController extends Controller
{
    /** T06/T11: GCE-only vehicle fields never leave the API on a customer or public read. */
    public const PRIVATE_VEHICLE_FIELDS = ['vin', 'plate_number', 'engine_number', 'chassis_number', 'financing_markup_pct'];

    public static function publicVehicle(Vehicle $vehicle): array
    {
        return array_diff_key(ApiRow::of($vehicle), array_flip(self::PRIVATE_VEHICLE_FIELDS));
    }

    /** The global financing markup, 10% when the setting is missing (src/lib/settings/financing.ts). */
    public static function globalMarkupPct(): float
    {
        $value = AppSetting::query()->where('key', 'financing_markup_pct')->value('value');
        $pct = is_numeric($value) ? (float) $value : (is_array($value) && is_numeric($value[0] ?? null) ? (float) $value[0] : null);

        return $pct !== null && $pct >= 0 ? $pct : 10.0;
    }

    /** GET /catalogue/vehicles: available cars, newest first, plus the caller's favourite ids. */
    public function index(Request $request): JsonResponse
    {
        $vehicles = Vehicle::query()->where('listing_state', 'available')->orderByDesc('posted_at')->get();
        $favouriteIds = Favourite::query()->where('customer_id', $request->user()->id)->pluck('vehicle_id');

        return response()->json([
            'vehicles' => $vehicles->map(fn (Vehicle $v) => self::publicVehicle($v))->values(),
            'favourite_ids' => $favouriteIds->values(),
        ]);
    }

    /** GET /catalogue/vehicles/{id}: only an available car, with its public media in display order. */
    public function show(string $id): JsonResponse
    {
        $vehicle = Vehicle::query()->where('id', $id)->where('listing_state', 'available')->firstOrFail();
        $media = VehicleMedia::query()->where('vehicle_id', $id)->where('public_state', true)
            ->whereIn('media_kind', VehicleMedia::VISIBLE_KINDS)
            ->orderBy('display_order')->get(['id', 'media_kind', 'storage_path', 'display_order']);

        return response()->json(['vehicle' => self::publicVehicle($vehicle), 'media' => ApiRow::list($media)]);
    }

    /** GET /catalogue/landing (public): published content, five newest available cars with their estimate, reviews. */
    public function landing(FileService $files): JsonResponse
    {
        $content = ContentItem::query()->where('publication_state', 'published')->orderByDesc('published_at')
            ->get(['id', 'content_kind', 'title', 'body', 'vehicle_id']);

        $globalPct = self::globalMarkupPct();
        $cars = Vehicle::query()->where('listing_state', 'available')->orderByDesc('posted_at')->limit(5)
            ->get(['id', 'make', 'model', 'year', 'current_price', 'stock_code', 'financing_markup_pct']);
        $photos = VehicleMedia::query()->whereIn('vehicle_id', $cars->pluck('id'))->where('media_kind', 'photo')
            ->where('public_state', true)->orderBy('display_order')->get(['vehicle_id', 'storage_path'])
            ->unique('vehicle_id')->mapWithKeys(fn ($m) => [$m->vehicle_id => $files->publicUrl('showroom-media', $m->storage_path)]);

        $carRows = $cars->map(function (Vehicle $car) use ($globalPct, $photos) {
            $own = $car->financing_markup_pct;
            $pct = $own !== null && (float) $own >= 0 ? (float) $own : $globalPct;
            $row = ApiRow::of($car, ['id', 'make', 'model', 'year', 'current_price', 'stock_code']);
            // Only the finished total leaves the API; the markup percentage is GCE's own figure (T11).
            $row['financed_total'] = (int) round((float) $car->current_price * (1 + $pct / 100));
            $row['photo_url'] = $photos[$car->id] ?? null;

            return $row;
        });

        return response()->json(['content' => ApiRow::list($content), 'cars' => $carRows->values(), 'reviews' => $this->publishedReviews()]);
    }

    /** src/server/customer-reviews.ts getPublishedReviews(). */
    private function publishedReviews(): array
    {
        $published = CustomerReview::query()->where('state', 'published');
        $count = (clone $published)->count();
        $average = $count ? (float) (clone $published)->avg('rating') : null;
        $reviews = (clone $published)->with('vehicle:id,make,model,year')->orderByDesc('created_at')->limit(6)->get();
        $names = Profile::query()->whereIn('id', $reviews->pluck('customer_id'))->pluck('full_name', 'id');

        return [
            'reviews' => $reviews->map(fn (CustomerReview $r) => ApiRow::of($r, ['id', 'rating', 'body', 'created_at']) + [
                'profiles' => ['full_name' => $names[$r->customer_id] ?? null],
                'vehicles' => ApiRow::of($r->vehicle, ['make', 'model', 'year']),
            ])->values(),
            'average' => $average,
            'count' => $count,
        ];
    }
}
