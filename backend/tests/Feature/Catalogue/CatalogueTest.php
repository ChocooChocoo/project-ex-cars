<?php

namespace Tests\Feature\Catalogue;

use App\Models\AppSetting;
use App\Models\ContentItem;
use App\Models\RecommendationRun;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleMedia;
use App\Services\RecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Auth\Concerns\MakesAccounts;
use Tests\TestCase;

/** Catalogue, favourites, recommendations and staff vehicle/content reads (Phase 4). */
class CatalogueTest extends TestCase
{
    use MakesAccounts, RefreshDatabase;

    private function vehicle(array $attributes = []): Vehicle
    {
        $vehicle = (new Vehicle)->forceFill($attributes + [
            'stock_code' => 'GCE-'.Str::upper(Str::random(6)), 'make' => 'Toyota', 'model' => 'Vios', 'year' => 2020,
            'current_price' => '850000.00', 'listing_state' => 'available', 'posted_at' => now(),
            'vin' => Str::upper(Str::random(17)), 'plate_number' => 'ABC 1234', 'financing_markup_pct' => '12.50',
        ]);
        $vehicle->save();

        return $vehicle->fresh();
    }

    /** A real 1x1 PNG (the GD extension is not required). */
    public static function png(): string
    {
        return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    }

    #[Test]
    public function showroom_lists_only_available_cars_without_private_fields(): void
    {
        $customer = $this->account('customer');
        $available = $this->vehicle();
        $this->vehicle(['listing_state' => 'draft']);

        $response = $this->as($customer)->getJson('/api/v1/catalogue/vehicles')->assertOk();
        $this->assertSame([$available->id], array_column($response->json('vehicles'), 'id'));
        $row = $response->json('vehicles.0');
        foreach (['vin', 'plate_number', 'engine_number', 'chassis_number', 'financing_markup_pct'] as $private) {
            $this->assertArrayNotHasKey($private, $row);
        }
        // PostgREST sent numeric columns as JSON numbers; the pages call toLocaleString() on them.
        $this->assertSame(850000, $row['current_price']);
        $this->assertSame([], $response->json('favourite_ids'));
    }

    #[Test]
    public function vehicle_detail_is_404_unless_available_and_hides_private_media(): void
    {
        $customer = $this->account('customer');
        $car = $this->vehicle();
        $draft = $this->vehicle(['listing_state' => 'draft']);
        (new VehicleMedia)->forceFill(['vehicle_id' => $car->id, 'media_kind' => 'photo', 'storage_path' => 'a.png', 'display_order' => 1, 'public_state' => true, 'uploaded_by' => $customer->id])->save();
        (new VehicleMedia)->forceFill(['vehicle_id' => $car->id, 'media_kind' => 'photo', 'storage_path' => 'b.png', 'display_order' => 0, 'public_state' => false, 'uploaded_by' => $customer->id])->save();

        $this->as($customer)->getJson("/api/v1/catalogue/vehicles/{$draft->id}")->assertNotFound();
        $response = $this->as($customer)->getJson("/api/v1/catalogue/vehicles/{$car->id}")->assertOk();
        $this->assertSame(['a.png'], array_column($response->json('media'), 'storage_path'));
        $this->assertSame(['id', 'media_kind', 'storage_path', 'display_order'], array_keys($response->json('media.0')));
    }

    #[Test]
    public function landing_is_public_and_sends_the_financed_total_not_the_markup(): void
    {
        AppSetting::query()->where('key', 'financing_markup_pct')->delete();
        $car = $this->vehicle(); // own markup 12.5%
        $other = $this->vehicle(['financing_markup_pct' => null, 'current_price' => '1000000.00', 'posted_at' => now()->subDay()]);
        (new ContentItem)->forceFill(['content_kind' => 'hero', 'title' => 'Hi', 'author_id' => $this->account('marketing_specialist')->id, 'publication_state' => 'published', 'published_at' => now()])->save();

        $response = $this->getJson('/api/v1/catalogue/landing')->assertOk();
        $cars = collect($response->json('cars'))->keyBy('id');
        $this->assertSame(956250, $cars[$car->id]['financed_total']);
        $this->assertSame(1100000, $cars[$other->id]['financed_total']); // global default 10%
        $this->assertSame(['id', 'make', 'model', 'year', 'current_price', 'stock_code', 'financed_total', 'photo_url'], array_keys($cars[$car->id]));
        $this->assertSame('Hi', $response->json('content.0.title'));
        $this->assertSame(['reviews' => [], 'average' => null, 'count' => 0], $response->json('reviews'));
    }

    #[Test]
    public function favourites_belong_to_the_session_user(): void
    {
        [$a, $b] = [$this->account('customer'), $this->account('customer')];
        $car = $this->vehicle();

        $this->as($a)->postJson("/api/v1/favourites/{$car->id}")->assertOk()->assertJson(['favourited' => true]);
        $this->as($a)->getJson('/api/v1/favourites')->assertOk()->assertJsonCount(1)->assertJsonMissingPath('0.vin');
        $this->as($b)->getJson('/api/v1/favourites')->assertOk()->assertJsonCount(0);
        $this->as($b)->getJson('/api/v1/catalogue/vehicles')->assertJson(['favourite_ids' => []]);
        $this->as($a)->postJson("/api/v1/favourites/{$car->id}")->assertOk()->assertJson(['favourited' => false]);
        $this->as($a)->postJson('/api/v1/favourites/'.Str::uuid())->assertNotFound();
    }

    #[Test]
    public function recommendation_engine_matches_the_typescript_fixture(): void
    {
        $fixture = json_decode(file_get_contents(base_path('tests/Fixtures/recommendation-parity.json')), true);
        foreach ($fixture['cases'] as $case) {
            $actual = app(RecommendationService::class)->rank($fixture['inputs'], (float) $case['budget']);
            $this->assertEquals($case['expected'], $actual, "budget {$case['budget']}");
        }
    }

    #[Test]
    public function recommendation_runs_are_private_to_their_owner(): void
    {
        [$a, $b] = [$this->account('customer'), $this->account('customer')];
        $car = $this->vehicle();
        $this->vehicle(['listing_state' => 'reserved']); // never ranked (was actions.available.test.ts)
        $prefs = ['make' => 'Toyota', 'bodyType' => 'Sedan', 'seats' => '5', 'purpose' => 'family'];

        $run = $this->as($a)->postJson('/api/v1/recommendations', ['budget' => 900000, 'preferences' => $prefs])->assertCreated();
        $runId = $run->json('runId');
        $this->assertSame([$car->id], array_column($run->json('scored'), 'vehicleId'));
        $this->assertSame(1, RecommendationRun::query()->count());

        $show = $this->as($a)->getJson("/api/v1/recommendations/{$runId}")->assertOk();
        $this->assertSame($car->id, $show->json('vehicles.0.id'));
        $this->assertSame(1, $show->json('results.0.rank'));
        $this->as($a)->getJson('/api/v1/recommendations')->assertOk()->assertJsonCount(1);

        $this->as($b)->getJson("/api/v1/recommendations/{$runId}")->assertForbidden();
        $this->as($b)->postJson("/api/v1/recommendations/{$runId}/feedback", ['selected_vehicle_id' => $car->id, 'helpful' => true])->assertForbidden();
        $this->as($a)->postJson("/api/v1/recommendations/{$runId}/feedback", ['selected_vehicle_id' => $car->id, 'helpful' => true])->assertCreated();
        $this->as($a)->postJson("/api/v1/recommendations/{$runId}/feedback", ['selected_vehicle_id' => (string) Str::uuid(), 'helpful' => true])->assertStatus(422);
        $this->as($a)->postJson('/api/v1/recommendations', ['budget' => 10, 'preferences' => $prefs])->assertStatus(422);
    }

    #[Test]
    public function staff_vehicle_reads_are_staff_only_and_role_shaped(): void
    {
        $car = $this->vehicle();
        $this->as($this->account('customer'))->getJson('/api/v1/staff/vehicles')->assertForbidden();
        $this->as($this->account('super_admin'))->getJson('/api/v1/staff/vehicles')->assertForbidden();

        $mechanic = $this->as($this->account('mechanic'))->getJson('/api/v1/staff/vehicles')->assertOk();
        $this->assertSame([], $mechanic->json('proposals'));
        $this->assertArrayHasKey('vin', $mechanic->json('vehicles.0')); // staff see GCE's identifiers
        $this->assertSame(10, $mechanic->json('default_markup_pct') ?? 10);

        // The Head Accountant reads pending proposals too (was vehicles-rls.test.ts).
        $ms = $this->account('marketing_specialist');
        (new \App\Models\VehiclePriceProposal)->forceFill(['vehicle_id' => $car->id, 'proposed_amount' => '900000.00', 'proposal_kind' => 'selling_price', 'decision' => 'pending', 'proposer_id' => $ms->id])->save();
        $accountant = $this->as($this->account('head_accountant'))->getJson('/api/v1/staff/vehicles')->assertOk();
        $this->assertSame(900000, $accountant->json('proposals.0.proposed_amount'));
        $this->assertSame(['make' => 'Toyota', 'model' => 'Vios', 'year' => 2020], $accountant->json('proposals.0.vehicles'));

        $detail = $this->as($this->account('ceo'))->getJson("/api/v1/staff/vehicles/{$car->id}")->assertOk();
        $this->assertSame(['vehicle', 'media', 'proposal', 'reconditioning', 'revision'], array_keys($detail->json()));
    }

    #[Test]
    public function only_marketing_specialists_manage_media_and_content(): void
    {
        Storage::fake('public');
        $car = $this->vehicle();
        $ms = $this->account('marketing_specialist');
        $photo = UploadedFile::fake()->createWithContent('car.png', self::png());

        $this->as($this->account('ceo'))->post("/api/v1/staff/vehicles/{$car->id}/media", ['media_kind' => 'photo', 'file' => $photo], ['Accept' => 'application/json'])->assertForbidden();
        $created = $this->as($ms)->post("/api/v1/staff/vehicles/{$car->id}/media", ['media_kind' => 'photo', 'file' => $photo], ['Accept' => 'application/json'])->assertCreated();
        $path = $created->json('storage_path');
        $this->assertStringStartsWith("{$car->id}/", $path);
        Storage::disk('public')->assertExists("showroom-media/{$path}");

        $this->as($ms)->deleteJson('/api/v1/staff/vehicle-media/'.$created->json('id'))->assertOk();
        Storage::disk('public')->assertMissing("showroom-media/{$path}");

        $this->as($this->account('ceo'))->postJson('/api/v1/staff/content', ['content_kind' => 'hero', 'title' => 'X'])->assertForbidden();
        $item = $this->as($ms)->postJson('/api/v1/staff/content', ['content_kind' => 'hero', 'title' => 'Sale'])->assertCreated();
        $this->as($ms)->postJson('/api/v1/staff/content/'.$item->json('id').'/publish')->assertOk()->assertJson(['publication_state' => 'published']);
        $this->as($this->account('ceo'))->getJson('/api/v1/staff/content')->assertOk()->assertJsonCount(1, 'items');
        $this->as($ms)->postJson('/api/v1/staff/content', ['content_kind' => 'announcement', 'title' => 'X'])->assertStatus(422);
    }

    #[Test]
    public function inspections_are_limited_to_viewer_roles(): void
    {
        foreach (['customer' => 403, 'head_accountant' => 403, 'marketing_specialist' => 403, 'mechanic' => 200, 'sales_manager' => 200] as $role => $status) {
            $this->as($this->account($role))->getJson('/api/v1/staff/inspections')->assertStatus($status);
        }
    }
}
