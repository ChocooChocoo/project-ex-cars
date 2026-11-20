<?php

namespace Tests\Feature\Trading;

use App\Services\Trading\BuyRules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Plan Phase 2: the meet-up pin is bounded to CALABARZON (SH-14), the seller's field-case location comes from the
 * pin instead of a typed input (SH-12), and a buyer's halfway meet-up saves the pin and its address (BH-8).
 */
class MeetupPointTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** A sell offer with its sell_details written straight to MySQL, as the intake controller does. */
    private function sellOffer(string $method = 'meet_halfway', ?array $point = ['lat' => 14.33, 'lng' => 120.94], ?string $address = 'Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon'): string
    {
        $customer = $this->customer();
        $id = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $id, 'customer_id' => $customer->id, 'created_by' => $customer->id, 'transaction_kind' => 'sell',
            'vehicle_id' => $this->vehicle(), 'current_state' => 'approved', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sell_details')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $id, 'offered_amount' => 500000,
            'meetup_method' => $method, 'meetup_lat' => $point['lat'] ?? null, 'meetup_lng' => $point['lng'] ?? null,
            'meetup_address' => $address, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('vehicle_price_proposals')->insert(['id' => (string) Str::uuid(), 'vehicle_id' => $this->vehicle(), 'transaction_id' => $id,
            'proposal_kind' => 'purchase_ceiling', 'proposed_amount' => 500000, 'proposer_id' => $customer->id, 'decision' => 'approved', 'created_at' => now()]);

        return $id;
    }

    #[Test]
    public function the_calabarzon_box_matches_the_browser_bounds(): void
    {
        // GCE, Dasmariñas: inside. Metro Manila: inside the box, so the browser's region check must catch it.
        $this->assertTrue(BuyRules::isInCalabarzon(14.32856, 120.957));
        $this->assertTrue(BuyRules::isInCalabarzon(14.5995, 120.9842));
        // The sea east of Quezon, the north edge and abroad are outside.
        $this->assertFalse(BuyRules::isInCalabarzon(15.5, 121));
        $this->assertFalse(BuyRules::isInCalabarzon(10.3, 123.9));
        $this->assertFalse(BuyRules::isInCalabarzon(51.5, -0.12));
        $this->assertFalse(BuyRules::isInCalabarzon('north', 121));
        $this->assertFalse(BuyRules::isInCalabarzon(null, null));
    }

    #[Test]
    public function the_marketing_specialist_reads_the_sellers_pin_instead_of_typing_it(): void
    {
        $ms = $this->account('marketing_specialist');
        $mechanic = $this->account('mechanic');
        $informant = $this->account('confidential_informant');
        $id = $this->sellOffer();

        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', [
            'transaction_id' => $id, 'agreed_price' => 450000, 'schedule' => $this->slot(3)->toIso8601String(),
            'informant_id' => $informant->id, 'mechanic_id' => $mechanic->id,
        ])->assertOk();

        $this->assertSame('Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon', DB::table('field_cases')->where('transaction_id', $id)->value('location'));
    }

    #[Test]
    public function the_field_case_location_falls_back_to_the_coordinates_without_an_address(): void
    {
        $ms = $this->account('marketing_specialist');
        $mechanic = $this->account('mechanic');
        $informant = $this->account('confidential_informant');
        $id = $this->sellOffer('meet_halfway', ['lat' => 14.32856, 'lng' => 120.957], null);

        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', [
            'transaction_id' => $id, 'agreed_price' => 450000, 'schedule' => $this->slot(3)->toIso8601String(),
            'informant_id' => $informant->id, 'mechanic_id' => $mechanic->id,
        ])->assertOk();

        $this->assertSame('14.32856, 120.95700', DB::table('field_cases')->where('transaction_id', $id)->value('location'));
    }

    #[Test]
    public function a_halfway_offer_without_a_pin_cannot_create_the_field_case(): void
    {
        $ms = $this->account('marketing_specialist');
        $mechanic = $this->account('mechanic');
        $informant = $this->account('confidential_informant');
        $id = $this->sellOffer('meet_halfway', null, null);

        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', [
            'transaction_id' => $id, 'agreed_price' => 450000, 'schedule' => $this->slot(3)->toIso8601String(),
            'informant_id' => $informant->id, 'mechanic_id' => $mechanic->id,
        ])->assertStatus(422)->assertJson(['message' => 'The seller has not set a meet-up point yet. Ask them to set it on the map.']);
        $this->assertSame(0, DB::table('field_cases')->where('transaction_id', $id)->count());
    }

    #[Test]
    public function a_gce_visit_keeps_gce_as_the_location(): void
    {
        $ms = $this->account('marketing_specialist');
        $mechanic = $this->account('mechanic');
        $id = $this->sellOffer('gce_visit', null, null);

        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', [
            'transaction_id' => $id, 'agreed_price' => 450000, 'schedule' => $this->slot(3)->toIso8601String(),
            'mechanic_id' => $mechanic->id,
        ])->assertOk();

        $this->assertSame('GCE', DB::table('field_cases')->where('transaction_id', $id)->value('location'));
    }

    #[Test]
    public function a_buyer_halfway_meetup_stores_the_pin_and_its_address(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'meetup');

        $this->act($buyer)->postJson('/api/v1/trading/buy-details', [
            'transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'meetup',
            'acknowledge_condition' => 'yes', 'meetup_lat' => 14.33, 'meetup_lng' => 120.94,
            'meetup_address' => 'Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon',
        ])->assertOk();

        $row = DB::table('purchase_details')->where('transaction_id', $id)->first();
        $this->assertSame(14.33, (float) $row->meetup_lat);
        $this->assertSame(120.94, (float) $row->meetup_lng);
        $this->assertSame('Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon', $row->meetup_address);
        // The address CHECK still reads `location`, so the composed address is stored there too.
        $this->assertSame($row->meetup_address, $row->location);
    }

    #[Test]
    public function a_pin_outside_calabarzon_is_refused_with_422(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'meetup');

        foreach ([[15.5, 121], [10.3, 123.9], [51.5, -0.12]] as [$lat, $lng]) {
            $this->act($buyer)->postJson('/api/v1/trading/buy-details', [
                'transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'meetup',
                'acknowledge_condition' => 'yes', 'meetup_lat' => $lat, 'meetup_lng' => $lng,
                'meetup_address' => 'Somewhere else',
            ])->assertStatus(422)->assertJson(['message' => 'Meet-ups must be inside CALABARZON.']);
        }
        $this->assertNull(DB::table('purchase_details')->where('transaction_id', $id)->value('meetup_lat'));
    }

    #[Test]
    public function a_meetup_without_a_pin_or_address_is_refused(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'meetup');

        $this->act($buyer)->postJson('/api/v1/trading/buy-details', [
            'transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'meetup',
            'acknowledge_condition' => 'yes', 'meetup_address' => 'Somewhere',
        ])->assertStatus(422);
        $this->again()->postJson('/api/v1/trading/buy-details', [
            'transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'meetup',
            'acknowledge_condition' => 'yes', 'meetup_lat' => 14.33, 'meetup_lng' => 120.94,
        ])->assertStatus(422);
    }

    /** A financed buy whose arrangement is a Meet Halfway, waiting for the buyer to accept the offer. */
    private function financedMeetup(string $arrangement = 'meetup'): array
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'financing', $arrangement, null,
            ['current_state' => 'approved', 'flow_status' => 'approved_awaiting_buyer_decision']);

        return [$buyer, $id];
    }

    #[Test]
    public function a_financed_meetup_without_a_pin_is_refused_not_crashed(): void
    {
        [$buyer, $id] = $this->financedMeetup();

        // The buyer accepts the offer but the pin was never saved: a 422 explains what to do, never a 500.
        $this->act($buyer)->postJson('/api/v1/trading/financing-offer', [
            'transaction_id' => $id, 'decision' => 'proceed', 'schedule' => $this->slot(3)->toIso8601String(),
        ])->assertStatus(422)->assertJson(['message' => 'Set the meet-up point on the map.']);
        $this->assertNull(DB::table('purchase_details')->where('transaction_id', $id)->value('meetup_lat'));
    }

    #[Test]
    public function a_financed_meetup_reuses_a_pin_already_saved(): void
    {
        [$buyer, $id] = $this->financedMeetup();
        DB::table('purchase_details')->where('transaction_id', $id)->update([
            'meetup_lat' => 14.33, 'meetup_lng' => 120.94, 'meetup_address' => 'Block 4 Lot 5, Bagong Bayan, Dasmariñas',
        ]);

        $this->act($buyer)->postJson('/api/v1/trading/financing-offer', [
            'transaction_id' => $id, 'decision' => 'proceed', 'schedule' => $this->slot(3)->toIso8601String(),
        ])->assertOk();

        $row = DB::table('purchase_details')->where('transaction_id', $id)->first();
        $this->assertSame(14.33, (float) $row->meetup_lat);
        $this->assertSame(120.94, (float) $row->meetup_lng);
        $this->assertSame('Block 4 Lot 5, Bagong Bayan, Dasmariñas', $row->location);
        $this->assertSame('meetup', DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->value('arrangement_kind'));
    }

    #[Test]
    public function a_financed_meetup_accepts_the_pin_in_the_request(): void
    {
        [$buyer, $id] = $this->financedMeetup();

        $this->act($buyer)->postJson('/api/v1/trading/financing-offer', [
            'transaction_id' => $id, 'decision' => 'proceed', 'schedule' => $this->slot(3)->toIso8601String(),
            'meetup_lat' => 14.4, 'meetup_lng' => 121, 'meetup_address' => 'SM Calamba',
        ])->assertOk();

        $row = DB::table('purchase_details')->where('transaction_id', $id)->first();
        $this->assertSame(14.4, (float) $row->meetup_lat);
        $this->assertSame('SM Calamba', $row->location);
    }

    #[Test]
    public function a_financed_meetup_pin_outside_calabarzon_is_refused(): void
    {
        [$buyer, $id] = $this->financedMeetup();

        $this->act($buyer)->postJson('/api/v1/trading/financing-offer', [
            'transaction_id' => $id, 'decision' => 'proceed', 'schedule' => $this->slot(3)->toIso8601String(),
            'meetup_lat' => 15.5, 'meetup_lng' => 121, 'meetup_address' => 'Somewhere north',
        ])->assertStatus(422)->assertJson(['message' => BuyRules::OUTSIDE_CALABARZON_MESSAGE]);
    }

    #[Test]
    public function a_buyer_pin_beyond_5_km_of_its_midpoint_is_refused_and_one_inside_is_saved(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'meetup');
        $body = ['transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'meetup',
            'acknowledge_condition' => 'yes', 'meetup_address' => 'Block 4 Lot 5, Bagong Bayan, Dasmariñas',
            'meetup_origin_lat' => 14.3, 'meetup_origin_lng' => 121.0];

        // ~11 km north of the midpoint, still inside CALABARZON.
        $this->act($buyer)->postJson('/api/v1/trading/buy-details', $body + ['meetup_lat' => 14.4, 'meetup_lng' => 121.0])
            ->assertStatus(422)->assertJson(['message' => BuyRules::TOO_FAR_FROM_MIDPOINT_MESSAGE]);
        $this->again()->postJson('/api/v1/trading/buy-details', $body + ['meetup_lat' => 14.33, 'meetup_lng' => 121.0])->assertOk();

        $row = DB::table('purchase_details')->where('transaction_id', $id)->first();
        $this->assertSame(14.3, (float) $row->meetup_origin_lat);
        $this->assertTrue(BuyRules::isNearMidpoint(14.33, 121.0, null, null));
    }
}
