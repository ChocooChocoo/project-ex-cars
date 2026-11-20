<?php

namespace Tests\Feature\Staff;

use App\Models\Vehicle;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Staff\Concerns\StaffFixtures;
use Tests\TestCase;

/**
 * Plan Phase 11 (BC-11): the Marketing Specialist describes the interior end to end — the posting form, the
 * controller, the column and the showroom detail that a buyer reads.
 */
class VehicleInteriorFeaturesTest extends TestCase
{
    use RefreshDatabase, StaffFixtures;

    private const FEATURES = 'Leather seats, 7 seats, rear AC';

    private function body(string $vin): array
    {
        return [
            'vin' => $vin, 'plate_number' => 'ABC 1234', 'engine_number' => 'ENG-9', 'chassis_number' => 'CHS-7',
            'make' => 'Toyota', 'model' => 'Innova', 'year' => 2022, 'interior_features' => self::FEATURES,
        ];
    }

    #[Test]
    public function the_posting_form_saves_interior_features_and_the_showroom_returns_them(): void
    {
        $ms = $this->account('marketing_specialist');
        $created = $this->act($ms)->postJson('/api/v1/staff/vehicles', $this->body('VIN-1'))->assertOk();
        $id = $created->json('id');
        $this->assertSame(self::FEATURES, DB::table('vehicles')->where('id', $id)->value('interior_features'));

        // The buyer only sees an available car; publish it the way the price approval does.
        DB::table('vehicles')->where('id', $id)->update(['listing_state' => 'available', 'current_price' => 900000]);

        $detail = $this->act($this->account('customer'))->getJson("/api/v1/catalogue/vehicles/{$id}")->assertOk();
        $this->assertSame(self::FEATURES, $detail->json('vehicle.interior_features'));
        $this->assertNull($detail->json('vehicle.interior_color'), 'an untouched optional column stays null');
    }

    #[Test]
    public function a_car_may_leave_the_interior_description_blank(): void
    {
        $ms = $this->account('marketing_specialist');
        $body = $this->body('VIN-2');
        unset($body['interior_features']);
        $this->act($ms)->postJson('/api/v1/staff/vehicles', $body)->assertOk();

        $this->assertNull(Vehicle::query()->where('vin', 'VIN-2')->value('interior_features'));
    }

    #[Test]
    public function interior_features_over_1000_characters_are_rejected_by_the_controller(): void
    {
        $ms = $this->account('marketing_specialist');
        $body = $this->body('VIN-3');
        $body['interior_features'] = str_repeat('x', 1001);

        $response = $this->act($ms)->postJson('/api/v1/staff/vehicles', $body)->assertStatus(422);
        $this->assertStringContainsString('interior features', strtolower((string) $response->json('message')));
        $this->assertSame(0, Vehicle::query()->count());
    }

    #[Test]
    public function the_database_check_constraint_rejects_an_overlong_description(): void
    {
        $row = ['id' => (string) Str::uuid(), 'stock_code' => 'GCE-'.Str::upper(Str::random(6)),
            'make' => 'Toyota', 'model' => 'Innova', 'year' => 2022, 'interior_features' => str_repeat('x', 1001)];
        try {
            DB::table('vehicles')->insert($row);
        } catch (QueryException) {
            $this->addToAssertionCount(1);

            return;
        }
        $this->fail('Expected the database to reject interior_features over 1000 characters.');
    }
}
